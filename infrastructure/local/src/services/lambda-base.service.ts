import {
  fork,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'child_process';
import { nanoid } from 'nanoid';
import { join } from 'path';
import type { ProjectLambdaConfig } from '../../../utils/infrastructure-config.types';
import { workspaceRootDir } from '../../../utils/workspace-root-dir';
import type { Service } from './service.interface';
import { Env } from './utils/env';
import { isCrappyPc } from './utils/is-crappy-pc';
import { ServiceLogger } from './utils/service-logger';

export interface LambdaServiceParams {
  config: ProjectLambdaConfig;
  logger: ServiceLogger;
  env: Env;
  apiPort: number;
  nxProjectName: string;
}

export class LambdaBaseService implements Service {
  public readonly config: ProjectLambdaConfig;
  private static nxBuildProcess: ChildProcessWithoutNullStreams | null = null;
  private static customBuildProcesses: ChildProcessWithoutNullStreams[] = [];
  private static nxProjectsToBuild: string[] = [];
  private static customBuildScripts: Map<string, string> = new Map();
  protected logger: ServiceLogger;
  protected readonly globalEnv: Env;
  protected readonly localEnv: Map<string, string> = new Map();
  protected readonly apiPort: number;
  private static staticLogger = new ServiceLogger('LambdaBaseService');
  private MAX_PARALLEL_EVENTS = isCrappyPc ? 1 : 5;
  private lambdaProcess: ChildProcessWithoutNullStreams | null = null;
  private eventHandlers: Map<
    string,
    { event: unknown; callback: ({ result: unknown, error: Error }) => unknown }
  > = new Map();

  constructor(params: LambdaServiceParams) {
    const { config, logger, env, apiPort, nxProjectName } =
      params;

    this.logger = logger;
    this.config = config;
    this.globalEnv = env;
    this.apiPort = apiPort;

    if (
      this.config.buildCommandOverwriteWatchMode ||
      this.config.buildCommandOverwrite
    ) {
      LambdaBaseService.customBuildScripts.set(
        nxProjectName,
        (this.config.buildCommandOverwriteWatchMode ??
          this.config.buildCommandOverwrite) as string
      );
    } else {
      LambdaBaseService.nxProjectsToBuild.push(nxProjectName);
    }
  }

  private static startOneCustomBuildProcess(
    nxProjectName: string,
    command: string
  ) {
    const args = command.split(' ');
    const process = spawn(args.shift()!, args, {
      cwd: workspaceRootDir,
    });
    this.customBuildProcesses.push(process);

    const projectLogger = new ServiceLogger(
      `LambdaBaseService:${nxProjectName}`
    );
    LambdaBaseService.nxBuildProcess = process;

    process.stdout.on('data', (data) => {
      projectLogger.log(`${data}`);
    });

    process.stderr.on('data', (data) => {
      projectLogger.log(`${data}`);
    });
  }

  private static startCustomBuildProcesses() {
    if (LambdaBaseService.customBuildProcesses.length > 0) {
      LambdaBaseService.customBuildProcesses.forEach((process) =>
        process.kill()
      );
    }

    LambdaBaseService.customBuildScripts.forEach(([command, nxProjectName]) => {
      LambdaBaseService.startOneCustomBuildProcess(nxProjectName, command);
    });
  }

  private static async startNxBuildProcess() {
    if (LambdaBaseService.nxBuildProcess) {
      LambdaBaseService.nxBuildProcess.kill();
    }

    LambdaBaseService.staticLogger.log(`Starting build process`);

    const command = `nx run-many --target=build --watch --parallel --max-parallel=${
      LambdaBaseService.nxProjectsToBuild.length
    } --projects=${LambdaBaseService.nxProjectsToBuild.join(',')}`;

    const args = command.split(' ');
    const process = spawn(args.shift()!, args, {
      cwd: workspaceRootDir,
    });

    LambdaBaseService.nxBuildProcess = process;

    process.stdout.on('data', (data) => {
      LambdaBaseService.staticLogger.log(`${data}`);
    });

    process.stderr.on('data', (data) => {
      LambdaBaseService.staticLogger.log(`${data}`);
    });

    // TODO: wait until first build succeeds
  }

  private async startLambdaProcessIfNotExists() {
    if (this.lambdaProcess) {
      return;
    }

    const workerFile = join(
      workspaceRootDir,
      'infrastructure',
      'local',
      'assets',
      'lambda-worker.js'
    );

    this.lambdaProcess = fork(workerFile, [], {
      cwd: workspaceRootDir,
      env: {
        ...process.env,
        ...this.globalEnv.toObject(),
        ...Object.fromEntries(this.localEnv),
      },
    });

    this.lambdaProcess.stdout?.on('data', (data) => {
      this.logger.log(`${data}`);
    });

    this.lambdaProcess.stderr?.on('data', (data) => {
      this.logger.log(`${data}`);
    });

    let killed = false;
    this.lambdaProcess.on('error', (error) => {
      this.logger.log(`worker error: ${error}`);
      throw error;
    });

    this.lambdaProcess.on('exit', async (code) => {
      if (killed) {
        return;
      }
      if (code !== 0) {
        const errorMessage = `worker exited with code: ${code}`;
        this.logger.log(errorMessage);
        throw new Error(errorMessage);
      }
    });

    type HandlerMessage = {
      type: 'log' | 'result';
      payload?: unknown;
      eventId: string;
    };
    const handleResult = (data: HandlerMessage) => {
      const eventId = data.eventId;
      if (!eventId) {
        throw new Error('eventId is missing');
      }

      this.logger.log(`received result for eventId: ${eventId}`)

      const { error, result } = data.payload as {
        error?: unknown;
        result?: unknown;
      };

      const handler = this.eventHandlers.get(eventId);

      if (!handler) {
        this.logger.log(`no handler for eventId: ${eventId}`);
        return;
      }

      const { callback } = handler;
      callback({ error, result });
      this.eventHandlers.delete(eventId);

      if (this.eventHandlers.size === 0) {
        this.logger.log(`no more active events`);
        killed = true;
        this.lambdaProcess.kill();
        this.lambdaProcess = null;
      }
    };

    const processLogger = this.logger.makeChildLogger('handler');
    this.lambdaProcess.on('message', (data: HandlerMessage) => {
      switch (data.type) {
        case 'log':
          processLogger.log(data.payload as string);
          break;

        case 'result':
          handleResult(data);
          break;

        default:
          throw new Error(`unknown message type: ${data.type}`);
      }
    });
  }

  public async executeHandler<T>(event: unknown): Promise<T> {
    while (this.eventHandlers.size >= this.MAX_PARALLEL_EVENTS) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const eventId = nanoid();

    await this.startLambdaProcessIfNotExists();
    return await new Promise((resolve, reject) => {
      this.eventHandlers.set(eventId, {
        event,
        callback: ({ result, error }) => {
          if (error) {
            return reject(error);
          }
          return resolve(result as T);
        },
      });
      this.lambdaProcess.send({
        type: 'execute',
        eventId,
        payload: {
          event,
          config: this.config,
        },
      });
    });
  }

  private prepareEnvironmentVariables() {
    Object.entries(this.config.env?.static ?? {}).forEach(([key, value]) => {
      this.localEnv.set(key, value as string);
    });

    Object.entries(this.config.env?.dynamic?.dynamoDb ?? {}).forEach(
      ([key, definition]) => {
        let value: string | null = null;
        if (definition.type === 'tableName') {
          value =
            this.globalEnv.get(`DYNAMO_TABLE_${definition.tableIdentifier}`) ??
            null;
        }

        if (!value) {
          throw new Error(`Unknown attribute type ${definition.type}`);
        }

        this.localEnv.set(key, value);
      }
    );

    Object.entries(this.config.env?.dynamic?.api ?? {}).forEach(
      ([key, attribute]) => {
        let value: string | null = null;

        if (attribute === 'apiEndpoint') {
          value = `http://localhost:${this.apiPort}`;
        }

        if (!value) {
          throw new Error(`Unknown attribute type ${attribute}`);
        }

        this.localEnv.set(key, value);
      }
    );
  }

  public async init() {
    this.prepareEnvironmentVariables();

    if (!isCrappyPc) {
      await LambdaBaseService.startNxBuildProcess();
      await LambdaBaseService.startCustomBuildProcesses();
    }
  }

  public async destroy() {
    if (LambdaBaseService.nxBuildProcess) {
      LambdaBaseService.staticLogger.log(`stopping nx build process`);
      LambdaBaseService.nxBuildProcess.kill();
    }

    LambdaBaseService.customBuildProcesses.forEach((process, index) => {
      LambdaBaseService.staticLogger.log(
        `stopping custom build process ${index + 1} of ${
          LambdaBaseService.customBuildProcesses.length
        }`
      );
      process.kill();
    });
  }
}
