import type { CloudFrontRequest, CloudFrontResponseEvent } from 'aws-lambda';
import type { CloudFrontResponse } from 'aws-lambda/common/cloudfront';
import { CloudFrontResultResponse } from 'aws-lambda/common/cloudfront';
import { S3, type AWSError } from 'aws-sdk';
import type { GetObjectResponse } from 'aws-sdk/clients/mediastoredata';
import cors from 'cors';
import express from 'express';
import { readFileSync } from 'fs';
import http from 'http';
import { nanoid } from 'nanoid';
import { join } from 'path';
import type { CDNConfig } from '../../../stacks/backend/cdn-stack';
import {workspaceConfig, workspaceRootDir} from '../../../utils/workspace-root-dir';
import { LambdaBaseService } from './lambda-base.service';
import type { Service } from './service.interface';
import { Env } from './utils/env';
import { ServiceLogger } from './utils/service-logger';

interface CdnServiceOptions {
  port: number;
  s3Port: number;
  env: Env;
  apiPort: number;
}

interface LambdaWithCloudfrontEventType {
  eventType: CDNConfig['edgeLambdas'][0]['eventType'];
  lambda: LambdaBaseService;
}

export class CdnService implements Service {
  private readonly app: express.Express;
  private readonly port: number;
  private server: http.Server | null = null;
  private readonly logger: ServiceLogger;
  private readonly s3: S3;
  private readonly env: Env;
  private readonly apiPort: number;
  private readonly edgeLambdas: LambdaWithCloudfrontEventType[];

  constructor(options: CdnServiceOptions) {
    const { port, s3Port, env, apiPort } = options;

    this.app = express();
    this.app.use(cors());
    this.port = port;
    this.logger = new ServiceLogger('CDN');
    this.s3 = new S3({
      endpoint: `http://localhost:${s3Port}`,
      region: 'eu-central-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
    this.env = env;
    this.apiPort = apiPort;
    this.edgeLambdas = [];
  }

  public async addCdn(cdnDefinition: CDNConfig) {
    const cdnPath = `/${cdnDefinition.subdomain.split('.').join('-')}`;

    this.app.use(
      cdnPath,
      await this.createRequestHandler(cdnDefinition, cdnPath)
    );
  }

  private async createRequestHandler(
    cdnDefinition: CDNConfig,
    cdnPath: string
  ) {
    const cdnEdgeLambdas: LambdaWithCloudfrontEventType[] = [];
    (cdnDefinition.edgeLambdas ?? []).forEach(
      (edgeLambdaDefinition, edgeLambdaIndex) => {
        if (edgeLambdaDefinition.eventType !== 'ORIGIN_RESPONSE') {
          throw new Error(
            'Only ORIGIN_RESPONSE event type is supported by now'
          );
        }

        const edgeLambdaProjectDir =
          workspaceConfig.projects[edgeLambdaDefinition.project];
        const edgeLambdaProjectConfiguration = JSON.parse(
          readFileSync(
            join(
              workspaceRootDir,
              edgeLambdaProjectDir,
              'infrastructure.config.json'
            )
          ).toString()
        );

        const lambda = new LambdaBaseService({
          env: this.env,
          nxProjectName: edgeLambdaDefinition.project,
          logger: this.logger
            .makeChildLogger(cdnDefinition.identifier)
            .makeChildLogger(
              `lambda@edge-${edgeLambdaDefinition.eventType}-${
                edgeLambdaIndex + 1
              }`
            ),
          config: edgeLambdaProjectConfiguration.lambda,
          apiPort: this.apiPort,
        });
        cdnEdgeLambdas.push({
          eventType: edgeLambdaDefinition.eventType,
          lambda,
        });
      }
    );
    this.edgeLambdas.push(...cdnEdgeLambdas);

    await Promise.all(
      cdnEdgeLambdas.map((edgeLambda) => edgeLambda.lambda.init())
    );

    return async (
      req: express.Request,
      res: express.Response
    ): Promise<void> => {
      const { bucketIdentifier } = cdnDefinition;

      const bucketName = this.env.get(`S3_BUCKET_${bucketIdentifier}`);

      const s3Key = req.path;

      const [, ...queryStringParts] = req.originalUrl.split('?');
      const queryString = queryStringParts.join('?');

      this.logger.log(
        `processing request for cdn ${cdnPath}, s3 key is: ${s3Key}`
      );

      const request: CloudFrontRequest = {
        clientIp: '0.0.0.0',
        method: req.method.toUpperCase(),
        uri: req.path,
        querystring: queryString,
        headers: {
          'x-forwarded-for': [
            {
              key: 'X-Forwarded-For',
              value: '203.0.113.178',
            },
          ],
          'user-agent': [
            {
              key: 'User-Agent',
              value: 'Amazon CloudFront',
            },
          ],
          via: [
            {
              key: 'Via',
              value:
                '2.0 8f22423015641505b8c857a37450d6c0.cloudfront.net (CloudFront)',
            },
          ],
          host: [
            {
              key: 'Host',
              value: `localhost:1709${cdnPath}`,
            },
          ],
          'cache-control': [
            {
              key: 'Cache-Control',
              value: 'no-cache, cf-no-cache',
            },
          ],
        },
        origin: {
          s3: {
            path: s3Key,
            authMethod: 'none',
            region: 'eu-central-1',
            customHeaders: {},
            domainName: 'my-fake-domain.org',
          },
        },
      };

      const file: GetObjectResponse | AWSError = await this.s3
        .getObject({
          Bucket: bucketName,
          Key: s3Key,
        })
        .promise()
        .then((res) => {
          this.logger.log(
            `s3 object found, content type is: ${res.ContentType}`
          );
          return res;
        })
        .catch((e) => {
          this.logger.log(`error while getting object from s3: ${e.message}`);
          return e;
        });

      const response: CloudFrontResponse = {
        headers: {},
        status: '500',
        statusDescription: 'Internal Server Error',
      };

      // noinspection SuspiciousTypeOfGuard
      if (file instanceof Error) {
        const error = file as AWSError;
        response.status = error.statusCode?.toString() ?? '500';
        response.statusDescription = error.message;
      } else {
        const fileData = file.Body as Buffer;
        response.headers['content-type'] = [
          {
            key: 'Content-Type',
            value: file.ContentType!,
          },
        ];
        response.headers['content-length'] = [
          {
            key: 'Content-Length',
            value: fileData.length.toString(),
          },
        ];
        response.status = '200';
        response.statusDescription = 'OK';
      }

      if (response.status === '403') {
        response.status = '404';
        response.statusDescription = 'Not Found';
      }

      const event: CloudFrontResponseEvent = {
        Records: [
          {
            cf: {
              request,
              response,
              config: {
                eventType: 'origin-response',
                distributionDomainName: 'my-fake-distribution-domain.org',
                distributionId: 'my-fake-distribution-id',
                requestId: nanoid(),
              },
            },
          },
        ],
      };

      const originResponseEdgeLambdas = cdnEdgeLambdas.filter(
        (edgeLambda) => edgeLambda.eventType === 'ORIGIN_RESPONSE'
      );

      try {
        let modifiedEvent = JSON.parse(JSON.stringify(event)) as typeof event;

        this.logger.log('executing edge lambdas...');

        for (const edgeLambda of originResponseEdgeLambdas) {
          this.logger.log(`executing ${edgeLambda.eventType} edge lambda...`);
          const modifiedResponse = (await edgeLambda.lambda.executeHandler(
            modifiedEvent
          )) as CloudFrontResponse;
          modifiedEvent.Records = modifiedEvent.Records.map((record) => ({
            ...record,
            cf: {
              ...record.cf,
              response: modifiedResponse,
            },
          }));
          this.logger.log(
            `${edgeLambda.eventType} edge lambda executed successfully`
          );
        }

        this.logger.log(`all edge lambdas executed successfully`);

        // noinspection SuspiciousTypeOfGuard
        const fileContents = file instanceof Error ? '' : file.Body;
        const response = modifiedEvent.Records[0].cf
          .response as CloudFrontResultResponse;
        let body: string | Buffer = response.body!;

        if (body && response.bodyEncoding === 'base64') {
          body = Buffer.from(body as string, 'base64');
        }

        if (!body) {
          body = fileContents as Buffer;
        }

        res.status(Number(response.status)).send(body);
        this.logger.log(`response sent successfully`);
      } catch (e) {
        res.status(500).send(e);
        this.logger.log(
          `error while executing cdn request: ${(e as Error).message}`
        );
      }
    };
  }

  public async init() {
    this.logger.log(`Starting CDN Server...`);
    this.server = this.app.listen(this.port);
    this.logger.log(`CDN available at http://localhost:${this.port}`);
  }

  public async destroy() {
    if (this.server) {
      this.logger.log('Stopping CDN server...');
      this.server.close();
    }

    this.logger.log('Stopping lambda@edge processes...');
    this.edgeLambdas.forEach((edgeLambda) => edgeLambda.lambda.destroy());
  }
}
