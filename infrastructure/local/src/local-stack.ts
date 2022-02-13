import { readFileSync } from 'fs';
import nodeCleanup from 'node-cleanup';
import { join } from 'path';
import { forEachProject } from '../../utils/project-infrastructure-config';
import { workspaceRootDir } from '../../utils/workspace-root-dir';
import { WorkspaceInfrastructureConfig } from '../types';
import { CdnService } from './services/cdn.service';
import { DynamoService } from './services/dynamo.service';
import { LambdaApiService } from './services/lambda-api.service';
import { S3Service } from './services/s3.service';
import { SecretsManagerService } from './services/secrets-manager.service';
import { Env } from './services/utils/env';
import { ServiceLogger } from './services/utils/service-logger';

export class LocalStack {
  public readonly ports = {
    secretsManager: 3000,
    api: 1996,
    cdn: 1709,
    s3: {
      api: 9000,
      gui: 9001,
    },
  };
  private readonly secretsManagerService: SecretsManagerService;
  private readonly dynamoService: DynamoService;
  private readonly lambdaApiServices: LambdaApiService[] = [];
  private readonly env = new Env();
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly s3Service: S3Service;
  private readonly cdnService: CdnService;
  private readonly logger: ServiceLogger;

  private constructor() {
    this.logger = new ServiceLogger('LocalStack');
    this.accessKeyId = 'fakeMyKeyId';
    this.secretAccessKey = 'fakeMySecretKey';

    this.secretsManagerService = new SecretsManagerService(
      this.ports.secretsManager,
      this.env
    );
    this.dynamoService = new DynamoService(
      this.env,
      this.accessKeyId,
      this.secretAccessKey
    );

    this.s3Service = new S3Service({
      apiPort: this.ports.s3.api,
      consolePort: this.ports.s3.gui,
      secretAccessKey: this.secretAccessKey,
      accessKeyId: this.accessKeyId,
      env: this.env,
    });

    this.cdnService = new CdnService({
      port: this.ports.cdn,
      env: this.env,
      apiPort: this.ports.api,
      s3Port: this.ports.s3.api,
    });

    nodeCleanup(() => {
      this.destroy().catch((e) => {
        console.error(e);
      });
    });
  }

  private async destroy() {
    await Promise.all([
      this.secretsManagerService.destroy(),
      this.dynamoService.destroy(),
      this.s3Service.destroy(),
      this.lambdaApiServices.map((service) => service.destroy()),
      this.cdnService.destroy(),
    ]);
  }

  // noinspection JSMethodCanBeStatic
  private setLocalDevelopmentEnvironmentVariables() {
    this.env.set(this.logger, 'LOCAL_DEVELOPMENT_ENVIRONMENT', 'true');
    this.env.set(this.logger, 'AWS_REGION', 'eu-central-1');
    this.env.set(this.logger, 'AWS_DEFAULT_REGION', 'eu-central-1');
    this.env.set(this.logger, 'AWS_ACCESS_KEY_ID', this.accessKeyId);
    this.env.set(this.logger, 'AWS_SECRET_ACCESS_KEY', this.secretAccessKey);
  }

  private async initGlobalInfrastructure() {
    await Promise.all([
      this.secretsManagerService.init(),
      this.dynamoService.init(),
      this.s3Service.init(),
    ]);

    const infrastructureConfig = JSON.parse(
      readFileSync(
        join(workspaceRootDir, 'infrastructure.config.json')
      ).toString()
    ) as WorkspaceInfrastructureConfig;

    const serviceInitCalls: Promise<void>[] = [];

    serviceInitCalls.push(
      ...(infrastructureConfig.dynamoDB?.tables.map((tableDefinition) => {
        return this.dynamoService.createOrUpdateDynamoTable(tableDefinition);
      }) ?? [])
    );

    serviceInitCalls.push(
      ...(infrastructureConfig.secrets?.generated.map((identifier) => {
        return this.secretsManagerService.setSecret(identifier);
      }) ?? [])
    );

    const secretsFileContents = readFileSync(
      join(workspaceRootDir, 'infrastructure', 'local', '.secrets')
    ).toString();
    const secrets = Object.fromEntries(
      secretsFileContents
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => line.split('='))
    );
    this.logger.log(`Creating secrets: ${JSON.stringify(secrets)}`);
    serviceInitCalls.push(
      ...(Object.keys(infrastructureConfig.secrets?.byArn ?? {}).map(
        (identifier) => {
          return this.secretsManagerService.setSecret(
            identifier,
            secrets[identifier]
          );
        }
      ) ?? [])
    );

    serviceInitCalls.push(
      ...(infrastructureConfig.s3?.buckets.map((bucketDefinition) => {
        return this.s3Service.createBucketIfNotExists(bucketDefinition);
      }) ?? [])
    );

    infrastructureConfig.cdn?.forEach((cdnDefinition) => {
      this.cdnService.addCdn(cdnDefinition);
    });
    serviceInitCalls.push(this.cdnService.init());

    await Promise.all(serviceInitCalls);
  }

  private async initProjects() {
    await forEachProject(async ({ projectName, config }) => {
      if (config.lambda?.dynamicRestApi) {
        this.lambdaApiServices.push(
          new LambdaApiService({
            nxProjectName: projectName,
            config: config.lambda,
            env: this.env,
            port: this.ports.api,
          })
        );
      }
    });

    await Promise.all(
      [
        ...this.lambdaApiServices,
      ].map((service) => service.init())
    );
  }

  public static async createAndInit() {
    const stack = new LocalStack();
    await stack.init();
    return stack;
  }

  private async init() {
    this.logger.log('Initializing ...');

    try {
      this.setLocalDevelopmentEnvironmentVariables();
      await this.initGlobalInfrastructure();
      await this.initProjects();

      this.logger.log('initialized');
      this.logger.log(
        `HTTP REST Api available at http://localhost:${this.ports.api}`
      );
      this.logger.log(
        `SecretsManager available at http://localhost:${this.ports.secretsManager}`
      );
    } catch (e) {
      this.logger.log(`Failed to initialize local stack: ${e.message}`);
      this.logger.log(e.name);
      this.logger.log(e.message);
      this.logger.log(e.stack);
      await this.destroy();
      throw e;
    }
  }
}
