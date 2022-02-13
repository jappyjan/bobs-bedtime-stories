import { SecretsManager } from 'aws-sdk';
import { GetSecretValueResponse } from 'aws-sdk/clients/secretsmanager';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import { join } from 'path';
import { workspaceRootDir } from '../../../utils/workspace-root-dir';
import { DockerService } from './docker.service';
import { Env } from './utils/env';
import { ServiceLogger } from './utils/service-logger';

export class SecretsManagerService extends DockerService {
  private readonly port: number;
  private secretsManager: SecretsManager;
  private readonly env: Env;
  private readonly secrets: Map<string, string>;

  constructor(port: number, env: Env) {
    super({
      logger: new ServiceLogger('SecretsManager'),
      container: {
        healthCheck: () => this.isHealthy(),
        imageOptions: {
          tagName: 'skarpdev/aws-secrets-manager-emulator:v0.4.0',
        },
        runOptions: {
          portMappings: [{ host: port, container: port }],
          environment: {
            SECRETS_MANAGER_PORT: `${port}`,
          },
          logging: 'error',
        },
      },
    });

    this.port = port;
    this.env = env;
    this.secrets = new Map<string, string>();
  }

  private async isHealthy(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      fetch(`http://localhost:${this.port}`)
        .then((res) => {
          resolve(res.status === 200);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  public async init() {
    await super.init();

    this.secretsManager = new SecretsManager({
      endpoint: `http://localhost:${this.port}`,
      region: 'eu-central-1',
    });

    this.logger.log('Started');
  }

  public async setSecret(identifier: string, value?: string) {
    if (this.secrets.has(identifier) && !value) {
      this.logger.log(`Not setting secret ${identifier} as it already exists`);
      return;
    }

    if (!value) {
      const secretsFolder = join(
        workspaceRootDir,
        'infrastructure',
        'local',
        'storage',
        'secrets'
      );
      if (!existsSync(secretsFolder)) {
        mkdirSync(secretsFolder, { recursive: true });
      }
      const secretsFile = join(secretsFolder, `${identifier}.secret`);
      if (existsSync(secretsFile)) {
        value = readFileSync(secretsFile).toString();
      } else {
        value = nanoid();
        writeFileSync(secretsFile, value);
      }
    }

    while (!(await this.isHealthy())) {
      // sleep 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // check if secret already exists
    const secret = await this.secretsManager
      .getSecretValue({
        SecretId: identifier,
      })
      .promise()
      .catch(() => {
        return false;
      });

    const SecretString = String(value);

    let secretName = (secret as GetSecretValueResponse)?.Name as string;
    if (!secret) {
      const secret = await this.secretsManager
        .createSecret({
          Name: identifier,
          SecretString,
        })
        .promise();
      secretName = secret.Name as string;
    }

    this.secrets.set(secretName, SecretString);

    this.env.set(this.logger, `SECRET_${identifier}_ARN`, secretName);
  }

  public getSecretValue(name: string) {
    return this.secrets.get(name);
  }
}
