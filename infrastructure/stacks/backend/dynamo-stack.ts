import {aws_dynamodb as dynamo, NestedStack, NestedStackProps, RemovalPolicy} from 'aws-cdk-lib';
import { ProjectLogger } from '../../utils/logger';
import {Construct} from "constructs";
import {workspaceInfrastructureConfig} from "../../utils/workspace-root-dir";

interface Props extends NestedStackProps {
  resourcesRemovalPolicy: RemovalPolicy;
  logger: ProjectLogger;
}

interface TableDefinition {
  identifier: string;
  partitionKey: {
    name: string;
    type: keyof typeof dynamo.AttributeType;
  };
  sortKey?: {
    name: string;
    type: keyof typeof dynamo.AttributeType;
  };
  autoScaling?: {
    read?: {
      min: number;
      max: number;
      targetUtilizationPercent: number;
    };
    write?: {
      min: number;
      max: number;
      targetUtilizationPercent: number;
    };
  };
  stream?: dynamo.StreamViewType;
  globalSecondaryIndexes?: Array<{
    partitionKey: {
      name: string;
      type: keyof typeof dynamo.AttributeType;
    };
    sortKey?: {
      name: string;
      type: keyof typeof dynamo.AttributeType;
    };
    indexName: string;
  }>;
}

export default class DynamoStack extends NestedStack {
  private readonly logger: ProjectLogger;
  public readonly tables: Record<string, dynamo.Table> = {};

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { resourcesRemovalPolicy: removalPolicy, logger } = props;
    this.logger = logger;

    this.logger('Creating Dynamo Stack');

    workspaceInfrastructureConfig.dynamoDB.tables.forEach((t) => {
      const tableDefinition = t as TableDefinition;

      const table = new dynamo.Table(
        this,
        `${tableDefinition.identifier}Table`,
        {
          partitionKey: {
            name: tableDefinition.partitionKey.name,
            type: dynamo.AttributeType[tableDefinition.partitionKey.type],
          },
          sortKey: tableDefinition.sortKey
            ? {
                name: tableDefinition.sortKey.name,
                type: dynamo.AttributeType[
                  tableDefinition.sortKey
                    .type as keyof typeof dynamo.AttributeType
                ],
              }
            : undefined,
          removalPolicy,
          stream: tableDefinition.stream
            ? dynamo.StreamViewType[tableDefinition.stream]
            : undefined,
          billingMode: Boolean(
            tableDefinition.autoScaling?.write ||
              tableDefinition.autoScaling?.read
          )
            ? dynamo.BillingMode.PROVISIONED
            : dynamo.BillingMode.PAY_PER_REQUEST,
        }
      );

      tableDefinition.globalSecondaryIndexes?.forEach((index) => {
        logger(`adding global secondary index ${index.indexName}`);

        const partitionKey = {
          name: index.partitionKey.name,
          type: dynamo.AttributeType[index.partitionKey.type],
        };

        let sortKey: dynamo.Attribute | undefined = undefined;
        if (index.sortKey) {
          sortKey = {
            name: index.sortKey.name,
            type: dynamo.AttributeType[index.sortKey.type],
          };
        }

        logger(`partitionKey - ${JSON.stringify(partitionKey, null, 4)}`);
        logger(`sortKey - ${JSON.stringify(sortKey, null, 4)}`);

        table.addGlobalSecondaryIndex({
          indexName: index.indexName,
          partitionKey,
          sortKey,
        });
      });

      if (tableDefinition.autoScaling?.read) {
        table
          .autoScaleReadCapacity({
            minCapacity: tableDefinition.autoScaling.read.min,
            maxCapacity: tableDefinition.autoScaling.read.max,
          })
          .scaleOnUtilization({
            targetUtilizationPercent:
              tableDefinition.autoScaling.read.targetUtilizationPercent,
          });
      }

      if (tableDefinition.autoScaling?.write) {
        table
          .autoScaleWriteCapacity({
            minCapacity: tableDefinition.autoScaling.write.min,
            maxCapacity: tableDefinition.autoScaling.write.max,
          })
          .scaleOnUtilization({
            targetUtilizationPercent:
              tableDefinition.autoScaling.write.targetUtilizationPercent,
          });
      }

      this.tables[tableDefinition.identifier] = table;

      this.logger(
        'created DynamoDB Table with identifier',
        tableDefinition.identifier
      );
    });
  }
}
