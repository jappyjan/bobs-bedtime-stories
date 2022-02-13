import { S3 } from 'aws-sdk';
import fetch from 'node-fetch';
import { S3BucketDefinition } from '../../types';
import { DockerService } from './docker.service';
import { Env } from './utils/env';
import { ServiceLogger } from './utils/service-logger';

interface S3ServiceParams {
  consolePort: number;
  apiPort: number;
  accessKeyId: string;
  secretAccessKey: string;
  env: Env;
}

export class S3Service extends DockerService {
  private readonly apiPort: number;
  private s3: S3;
  private readonly env: Env;

  constructor(params: S3ServiceParams) {
    const { env, consolePort, apiPort, accessKeyId, secretAccessKey } = params;

    super({
      logger: new ServiceLogger('S3'),
      container: {
        imageOptions: {
          tagName: 'quay.io/minio/minio',
        },
        runOptions: {
          portMappings: [
            { container: 9000, host: apiPort },
            { container: 9001, host: consolePort },
          ],
          environment: {
            MINIO_ROOT_USER: accessKeyId,
            MINIO_ROOT_PASSWORD: secretAccessKey,
          },
          commandAndArguments: [
            'server',
            '/data',
            // '--console-address',
            // `:${consolePort}`,
          ],
        },
        healthCheck: () => this.healthCheck(),
      },
    });

    this.apiPort = apiPort;
    this.env = env;
  }

  private async healthCheck() {
    return await fetch(`http://localhost:${this.apiPort}/minio/health/live`)
      .then((response) => response.status === 200)
      .catch(() => false);
  }

  public async init() {
    await super.init();

    this.s3 = new S3({
      endpoint: `http://localhost:${this.apiPort}`,
      region: 'eu-central-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
  }

  public async createBucketIfNotExists(definition: S3BucketDefinition) {
    let bucketName = definition.explicitName ?? definition.identifier;

    if (definition.explicitName) {
      bucketName = bucketName.replace('{{stack-name}}', 'localStack');
    }

    bucketName = bucketName
      .toLowerCase()
      .split(' ')
      .join('-')
      .split('/')
      .join('-')
      .split('_')
      .join('-')
      .trim();

    if (await this.bucketExists(bucketName)) {
      this.env.set(
        this.logger,
        `S3_BUCKET_${definition.identifier}`,
        bucketName
      );
      return;
    }

    this.logger.log(`Creating bucket ${bucketName}...`);

    await this.s3
      .createBucket({
        Bucket: bucketName,
      })
      .promise();

    this.env.set(this.logger, `S3_BUCKET_${definition.identifier}`, bucketName);
    this.logger.log(`Created bucket ${bucketName}`);
  }

  private async bucketExists(bucketName: string) {
    const buckets = await this.s3.listBuckets().promise();

    if (!buckets.Buckets) {
      return false;
    }

    return buckets.Buckets.some((bucket) => bucket.Name === bucketName);
  }
}
