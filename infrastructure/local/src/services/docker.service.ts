import {
  ChildProcessWithoutNullStreams,
  ExecSyncOptions,
  spawn,
} from 'child_process';
import ObjectHash from 'node-object-hash';
import { Service } from './service.interface';
import { ServiceLogger } from './utils/service-logger';

interface ImageOptions {
  tagName: string;
  dockerFile?: {
    workingDir?: string;
    fileName: string;
  };
}

type HealthCheck = () => Promise<boolean>;

interface RunOptions {
  commandAndArguments?: string[];
  portMappings?: Array<{ host: number; container: number }>;
  workingDir?: string;
  logging?: 'error' | 'all';
  volumes?: Array<{
    identifier?: string;
    containerMountDir: string;
    hostMountDir?: string;
  }>;
  environment?: Record<string, string>;
}

interface ContainerOptions {
  healthCheck?: HealthCheck;
  imageOptions: ImageOptions;
  runOptions?: RunOptions;
  name?: string;
}

interface DockerServiceParams {
  logger: ServiceLogger;
  container: ContainerOptions | ContainerOptions[];
}

interface FullContainerDefinition extends ContainerOptions {
  logger: ServiceLogger;
  name: string;
}

async function execWithLogging(
  logger: ServiceLogger,
  command: string,
  options?: ExecSyncOptions
): Promise<void> {
  const args = command.split(' ');
  logger.log(
    `Executing: ${args.join(' ')} with options: ${JSON.stringify(options)}`
  );
  const execProcess = spawn(args.shift()!, args, options);
  execProcess.stdout.on('data', (data) => {
    logger.log(data.toString());
  });

  let error = '';
  execProcess.stderr.on('data', (data) => {
    logger.log(data.toString());
    error += data.toString();
  });

  execProcess.on('error', (err) => {
    logger.log(`Command ${command} failed with error: ${err}`);
    throw err;
  });

  // await finish of process
  await new Promise<void>((resolve, reject) => {
    execProcess.on('close', (code) => {
      if (code !== 0) {
        logger.log(`Command ${command} exited with code ${code}`);
        logger.log(error);
        return reject(new Error(error));
      }
      resolve();
    });
  });
}

export class DockerService implements Service {
  protected readonly logger: ServiceLogger;
  private processes: ChildProcessWithoutNullStreams[] = [];
  private readonly containerDefinitions: FullContainerDefinition[];
  private readonly volumeIdentifierPrefix: string;

  constructor(params: DockerServiceParams) {
    const { logger, container } = params;

    const hasher = ObjectHash();

    this.containerDefinitions = (
      Array.isArray(container) ? container : [container]
    ).map((definition) => ({
      ...definition,
      logger: logger.makeChildLogger(definition.imageOptions.tagName),
      name:
        definition.name || `local-stack-${hasher.hash(definition)}`,
    }));

    this.volumeIdentifierPrefix = 'local-stack-';
    this.logger = logger;
  }

  // noinspection JSMethodCanBeStatic
  private async buildFromDockerFile(
    containerDefinition: FullContainerDefinition
  ) {
    containerDefinition.logger.log('Building image from Dockerfile...');
    const { workingDir, fileName } =
      containerDefinition.imageOptions.dockerFile!;
    const tagName = containerDefinition.imageOptions.tagName;
    const command = `docker build -f ${fileName} -t ${tagName} .`;
    await execWithLogging(this.logger, command, { cwd: workingDir });
    containerDefinition.logger.log(`Image built successfully (${tagName})`);
  }

  // noinspection JSMethodCanBeStatic
  private async pullDockerImage(containerDefinition: FullContainerDefinition) {
    const tagName = containerDefinition.imageOptions.tagName;

    try {
      containerDefinition.logger.log(`Pulling image ${tagName}...`);

      const command = `docker pull ${tagName}`;

      await execWithLogging(this.logger, command);

      containerDefinition.logger.log('Image pulled successfully');
    } catch (e) {
      containerDefinition.logger.log(`Failed to pull image ${tagName}`);
      containerDefinition.logger.log(e as string);
    }
  }

  private async startDockerContainer(
    containerDefinition: FullContainerDefinition
  ) {
    await this.stopContainer(containerDefinition.name);

    const tagName = containerDefinition.imageOptions.tagName;

    await Promise.all(
      (containerDefinition.runOptions?.volumes ?? []).map(
        (volumeDefinition) => {
          if (volumeDefinition.identifier) {
            return execWithLogging(
              this.logger,
              `docker volume create ${this.volumeIdentifierPrefix}${volumeDefinition.identifier}`
            );
          }
          return Promise.resolve();
        }
      )
    );

    const args = [
      'docker',
      'run',
      ...(containerDefinition.runOptions?.portMappings ?? [])
        .map((mapping) => `-p ${mapping.host}:${mapping.container}`.split(' '))
        .flat(),
      ...(containerDefinition.runOptions?.volumes ?? [])
        .map((volumeDefinition) =>
          `-v ${
            volumeDefinition.identifier
              ? this.volumeIdentifierPrefix + volumeDefinition.identifier
              : volumeDefinition.hostMountDir
          }:${volumeDefinition.containerMountDir}`.split(' ')
        )
        .flat(),
      ...Object.entries(containerDefinition.runOptions?.environment ?? {})
        .map(([key, value]) => `-e ${key}=${value}`.split(' '))
        .flat(),
      '--name',
      containerDefinition.name,
      tagName,
      ...(containerDefinition.runOptions?.commandAndArguments ?? []),
    ];

    this.logger.log(`Starting container ${tagName} (${args.join(' ')})`);
    const container = spawn(args.shift()!, args, {
      cwd: containerDefinition.runOptions?.workingDir,
    });
    this.processes.push(container);

    container.stdout.setEncoding('utf8');
    container.stderr.setEncoding('utf8');

    if (containerDefinition.runOptions?.logging !== 'error') {
      container.stdout.on('data', (data) => {
        containerDefinition.logger.log(data.toString());
      });
    }

    container.stderr.on('data', (data) => {
      containerDefinition.logger.log(data.toString());
    });

    container.on('close', (code) => {
      this.logger.log(`Container ${tagName} exited with code ${code}`);
      setTimeout(() => {
        this.startDockerContainer(containerDefinition);
      });
    });

    const isRunning = containerDefinition.healthCheck ?? (async () => true);
    let isHealthy = await isRunning();
    while (!isHealthy) {
      containerDefinition.logger.log('Waiting for container to be healthy...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      isHealthy = await isRunning();
    }
  }

  public async initOneContainer(containerDefinition: FullContainerDefinition) {
    containerDefinition.logger.log(`Starting container...`);
    if (containerDefinition.imageOptions.dockerFile) {
      await this.buildFromDockerFile(containerDefinition);
    } else {
      await this.pullDockerImage(containerDefinition);
    }

    await this.startDockerContainer(containerDefinition);
    containerDefinition.logger.log(`container started successfully`);
  }

  public async init() {
    this.logger.log('Starting containers...');
    await Promise.all(
      this.containerDefinitions.map((containerDefinition) =>
        this.initOneContainer(containerDefinition)
      )
    );
    this.logger.log('All Containers started successfully');
  }

  private async stopContainer(name: string) {
    this.logger.log(`Stopping container ${name}...`);
    await execWithLogging(this.logger, `docker container stop ${name}`)
      .then(() => {
        this.logger.log(`Container ${name} stopped successfully`);
      })
      .catch((e) => {
        if (e.message.includes('No such container')) {
          this.logger.log(`Container ${name} did not exist`);
        } else {
          throw e;
        }
      });
    await execWithLogging(this.logger, `docker container rm ${name}`)
      .then(() => {
        this.logger.log(`Container ${name} removed successfully`);
      })
      .catch((e) => {
        if (e.message.includes('No such container')) {
          this.logger.log(`Container ${name} did not exist`);
        } else {
          throw e;
        }
      });
  }

  public async destroy() {
    if (this.processes.length === 0) {
      return;
    }
    this.logger.log('Stopping containers...');

    await Promise.all(
      this.containerDefinitions.map((definition) => {
        return this.stopContainer(definition.name);
      })
    );

    this.processes.map((process) => process.kill('SIGKILL'));
  }
}
