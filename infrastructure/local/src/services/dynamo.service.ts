import { DynamoDB } from 'aws-sdk';
import { KeySchemaElement, UpdateTableInput } from 'aws-sdk/clients/dynamodb';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync, mkdirSync, rmdirSync } from 'fs';
import fetch from 'node-fetch';
import { join } from 'path';
import { workspaceRootDir } from '../../../utils/workspace-root-dir';
import { DynamoTableDefinition } from '../../types';
import { DockerService } from './docker.service';
import { Env } from './utils/env';
import { ServiceLogger } from './utils/service-logger';

interface DynamoKeyDefinition {
  AttributeName: string;
  KeyType: 'HASH' | 'RANGE';
  AttributeType: string;
}

export class DynamoService extends DockerService {
  private readonly env: Env;
  private dynamo: DynamoDB;
  public readonly dynamoPort: number;
  private readonly guiPort: number;
  private readonly awsAccessKeyId: string;
  private readonly awsSecretAccessKey: string;
  private guiProcess: ChildProcessWithoutNullStreams | null;

  constructor(env: Env, awsAccessKeyId: string, awsSecretAccessKey: string) {
    const dynamoPort = 8000;
    const guiPort = 8001;

    const dynamoMountDir = join(
      workspaceRootDir,
      'infrastructure',
      'local',
      'storage',
      'dynamoDB'
    );

    if (existsSync(dynamoMountDir)) {
      rmdirSync(dynamoMountDir, { recursive: true });
    }

    mkdirSync(dynamoMountDir, {
      recursive: true,
    });

    super({
      logger: new ServiceLogger('Dynamo'),
      container: [
        {
          imageOptions: {
            tagName: 'amazon/dynamodb-local',
          },
          runOptions: {
            portMappings: [{ host: dynamoPort, container: 8000 }],
            volumes: [
              {
                containerMountDir: '/home/dynamodblocal/data',
                hostMountDir: dynamoMountDir,
              },
            ],
            commandAndArguments: [
              '-jar',
              'DynamoDBLocal.jar',
              '-sharedDb',
              '-dbPath',
              '/home/dynamodblocal/data/',
            ],
          },
          healthCheck: () => this.dynamoIsHealthy(),
        },
      ],
    });

    this.awsAccessKeyId = awsAccessKeyId;
    this.awsSecretAccessKey = awsSecretAccessKey;
    this.env = env;
    this.dynamoPort = dynamoPort;
    this.guiPort = guiPort;
    this.guiProcess = null;
  }

  public async init(): Promise<void> {
    this.dynamo = new DynamoDB({
      endpoint: `http://localhost:${this.dynamoPort}`,
      region: 'localhost',
      accessKeyId: 'DEFAULT_ACCESS_KEY', // needed if you don't have aws credentials at all in env
      secretAccessKey: 'DEFAULT_SECRET',
    });

    await super.init();
    await this.startGui();
  }

  public async destroy() {
    if (this.guiProcess) {
      this.logger.makeChildLogger('GUI').log('Stopping...');
      this.guiProcess.kill();
    }
  }

  private async startGui() {
    const guiLogger = this.logger.makeChildLogger('GUI');

    guiLogger.log('Starting...');

    this.guiProcess = spawn('dynamodb-admin', {
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: this.awsAccessKeyId,
        AWS_SECRET_ACCESS_KEY: this.awsSecretAccessKey,
        DYNAMO_ENDPOINT: `http://localhost:${this.dynamoPort}`,
      },
    });

    this.guiProcess.stdout.on('data', (data) => {
      guiLogger.log(data.toString());
    });
    this.guiProcess.stderr.on('data', (data) => {
      guiLogger.log(data.toString());
    });
    this.guiProcess.on('close', (code) => {
      guiLogger.log(`GUI process exited with code ${code}`);
    });
    this.guiProcess.on('error', (err) => {
      guiLogger.log(`GUI process error: ${err}`);
      throw err;
    });

    while (!(await this.guiIsHealthy())) {
      guiLogger.log('Waiting for GUI to start...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    guiLogger.log('Started');
  }

  private async dynamoIsHealthy() {
    try {
      await this.dynamo.listTables().promise();
      return true;
    } catch (e) {
      return false;
    }
  }

  private async guiIsHealthy() {
    try {
      const response = await fetch(`http://localhost:${this.guiPort}`);
      return response.status === 200;
    } catch (e) {
      return false;
    }
  }

  public async createOrUpdateDynamoTable(
    dynamoConfig: DynamoTableDefinition
  ): Promise<void> {
    this.logger.log(`Create or update table ${dynamoConfig.identifier}...`);

    this.env.set(
      this.logger,
      `DYNAMO_TABLE_${dynamoConfig.identifier}`,
      dynamoConfig.identifier
    );

    const tableDefinition = await this.dynamo
      .describeTable({
        TableName: dynamoConfig.identifier,
      })
      .promise()
      .catch((e) => {
        this.logger.log(e);
        return null;
      });

    if (tableDefinition) {
      await this.updateDynamoTable(dynamoConfig);
    } else {
      await this.createDynamoTable(dynamoConfig);
    }
  }

  private getGlobalSecondaryIndexesFromDynamoConfig(
    config: DynamoTableDefinition
  ) {
    if (!config.globalSecondaryIndexes) {
      return undefined;
    }

    return config.globalSecondaryIndexes.map((indexDefinition) => {
      const keySchema: (KeySchemaElement & { AttributeType: string })[] = [];
      if (indexDefinition.partitionKey) {
        keySchema.push({
          AttributeName: indexDefinition.partitionKey.name,
          KeyType: 'HASH',
          AttributeType: indexDefinition.partitionKey.type,
        });
      }
      if (indexDefinition.sortKey) {
        keySchema.push({
          AttributeName: indexDefinition.sortKey.name,
          KeyType: 'RANGE',
          AttributeType: indexDefinition.sortKey.type,
        });
      }

      return {
        KeySchema: keySchema,
        IndexName: indexDefinition.indexName,
        Projection: {
          ProjectionType: 'ALL',
        },
      };
    });
  }

  private getAttributeDefinitions(dynamoConfig: DynamoTableDefinition) {
    const keySchema =
      DynamoService.getDynamoKeySchemaFromDynamoConfig(dynamoConfig);

    const globalSecondaryIndexes =
      this.getGlobalSecondaryIndexesFromDynamoConfig(dynamoConfig);

    let attributeDefinitions = keySchema.map((key) => ({
      AttributeName: key.AttributeName,
      AttributeType: DynamoService.mapDynamoAttributeType(key.AttributeType),
    }));

    if (globalSecondaryIndexes) {
      globalSecondaryIndexes.forEach((index) => {
        index.KeySchema.forEach((keySchema) => {
          attributeDefinitions.push({
            AttributeName: keySchema.AttributeName,
            AttributeType: DynamoService.mapDynamoAttributeType(
              keySchema.AttributeType
            ),
          });
        });
      });
    }

    return attributeDefinitions.filter((value, index, self) => {
      return (
        self.findIndex((a) => a.AttributeName === value.AttributeName) === index
      );
    });
  }

  private async createDynamoTable(
    dynamoConfig: DynamoTableDefinition
  ): Promise<void> {
    this.logger.log(`Create table ${dynamoConfig.identifier}...`);

    const keySchema =
      DynamoService.getDynamoKeySchemaFromDynamoConfig(dynamoConfig);

    const globalSecondaryIndexes =
      this.getGlobalSecondaryIndexesFromDynamoConfig(dynamoConfig);

    const attributeDefinitions = this.getAttributeDefinitions(dynamoConfig);

    await this.dynamo
      .createTable({
        TableName: dynamoConfig.identifier,
        KeySchema: keySchema.map((key) => ({
          AttributeName: key.AttributeName,
          KeyType: key.KeyType,
        })),
        AttributeDefinitions: attributeDefinitions,
        BillingMode: 'PAY_PER_REQUEST',
        StreamSpecification: {
          StreamEnabled: Boolean(dynamoConfig.stream),
          StreamViewType: dynamoConfig.stream,
        },
        GlobalSecondaryIndexes: globalSecondaryIndexes?.map((index) => ({
          Projection: index.Projection,
          IndexName: index.IndexName,
          KeySchema: index.KeySchema.map((schema) => ({
            AttributeName: schema.AttributeName,
            KeyType: schema.KeyType,
          })),
        })),
      } as DynamoDB.Types.CreateTableInput)
      .promise()
      .catch((err) => {
        this.logger.log(
          `Failed to create table ${dynamoConfig.identifier}: ${err.message}`
        );
        this.logger.log(
          JSON.stringify(
            {
              name: (err as Error).name,
              message: (err as Error).message,
              stack: (err as Error).stack,
            },
            null,
            4
          )
        );
        throw err;
      });

    this.logger.log(`Created table ${dynamoConfig.identifier}`);
  }

  private async updateDynamoTable(
    dynamoConfig: DynamoTableDefinition
  ): Promise<void> {
    this.logger.log(`Update table ${dynamoConfig.identifier}...`);

    this.logger.log(
      `Getting table description for ${dynamoConfig.identifier}...`
    );
    const current = await this.dynamo
      .describeTable({
        TableName: dynamoConfig.identifier,
      })
      .promise();

    const newKeySchema =
      DynamoService.getDynamoKeySchemaFromDynamoConfig(dynamoConfig);

    let needsRebuild = false;
    // determine if current.Table.KeySchema still matches
    if (current.Table?.KeySchema?.length !== newKeySchema.length) {
      needsRebuild = true;
    }

    const keyDontMatch =
      (newKey: KeySchemaElement) => (currentKey: KeySchemaElement) => {
        if (currentKey.KeyType !== newKey.KeyType) {
          return true;
        }

        // noinspection RedundantIfStatementJS
        if (currentKey.AttributeName !== newKey.AttributeName) {
          return true;
        }

        return false;
      };

    newKeySchema.forEach((newKey) => {
      if (current.Table?.KeySchema?.some(keyDontMatch(newKey))) {
        needsRebuild = true;
      }
    });

    if (needsRebuild) {
      this.logger.log(`Table ${dynamoConfig.identifier} needs update`);
      this.logger.log(`Deleting table ${dynamoConfig.identifier}...`);
      await this.dynamo
        .deleteTable({
          TableName: dynamoConfig.identifier,
        })
        .promise();

      this.logger.log(
        `Waiting for table ${dynamoConfig.identifier} to be deleted...`
      );

      // sleep 4s
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await this.createDynamoTable(dynamoConfig);
      return;
    }

    this.logger.log(
      `Updating AttributeDefinitions for ${dynamoConfig.identifier}...`
    );
    const attributeDefinitions = this.getAttributeDefinitions(dynamoConfig);
    await this.dynamo
      .updateTable({
        TableName: dynamoConfig.identifier,
        AttributeDefinitions: attributeDefinitions,
      })
      .promise()
      .catch((e) => {
        if (e.message === 'Nothing to update') {
          return;
        }
        throw e;
      });

    this.logger.log(
      `Updating StreamSpecification for ${dynamoConfig.identifier}...`
    );
    await this.dynamo
      .updateTable({
        TableName: dynamoConfig.identifier,
        StreamSpecification: {
          StreamEnabled: Boolean(dynamoConfig.stream),
          StreamViewType: dynamoConfig.stream,
        },
      } as UpdateTableInput)
      .promise()
      .catch((e) => {
        if (
          e.message === 'Nothing to update' ||
          e.message === 'Table already has an enabled stream'
        ) {
          return;
        }

        throw e;
      });

    const expectedGlobalSecondaryIndexes =
      this.getGlobalSecondaryIndexesFromDynamoConfig(dynamoConfig);

    this.logger.log(
      `Updating GlobalSecondaryIndexes for ${dynamoConfig.identifier}...`
    );
    this.logger.log(
      'Currently not supported to update global secondary indexes'
    );
    /*
    await this.dynamo.updateTable({
      TableName: dynamoConfig.identifier,
      GlobalSecondaryIndexUpdates: expectedGlobalSecondaryIndexes.map((index) => ({

      })),
    } as UpdateTableInput).promise()
      .catch((e) => {
        if (e.message === 'Nothing to update') {
          return;
        }

        throw e;
      });
     */
  }

  private static getDynamoKeySchemaFromDynamoConfig(
    config: DynamoTableDefinition
  ) {
    const schema: Array<DynamoKeyDefinition> = [
      {
        AttributeName: config.partitionKey.name,
        KeyType: 'HASH',
        AttributeType: config.partitionKey.type,
      },
    ];

    if (config.sortKey) {
      schema.push({
        AttributeName: config.sortKey.name,
        KeyType: 'RANGE',
        AttributeType: config.sortKey.type,
      });
    }

    return schema;
  }

  private static mapDynamoAttributeType(type: string) {
    switch (type) {
      case 'STRING':
        return 'S';
      case 'NUMBER':
        return 'N';
      case 'BOOLEAN':
        return 'BOOL';
      default:
        throw new Error(`Unknown DynamoDB attribute type: ${type}`);
    }
  }
}
