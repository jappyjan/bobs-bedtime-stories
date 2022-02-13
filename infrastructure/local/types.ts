import { CDNConfig } from '../stacks/backend/cdn-stack';
import { ProjectInfrastructureConfig } from '../utils/infrastructure-config.types';

export interface OpenSearchStageConfiguration {
  capacity: {
    dataNodes: number;
    dataNodeInstanceType: string;
  };
  ebs: {
    volumeSize: number;
  };
  logging: {
    slowSearchLogEnabled: boolean;
    appLogEnabled: boolean;
    slowIndexLogEnabled: boolean;
  };
}

export interface DynamoTableDefinition {
  identifier: string;
  partitionKey: {
    name: string;
    type: string;
  };
  sortKey?: {
    name: string;
    type: string;
  };
  stream: 'NEW_AND_OLD_IMAGES' | 'NEW_IMAGES' | 'OLD_IMAGES';
  globalSecondaryIndexes?: Array<{
    indexName: string;
    partitionKey: {
      name: string;
      type: string;
    };
    sortKey?: {
      name: string;
      type: string;
    };
  }>;
}

export interface OpenSearchDomainConfiguration {
  identifier: string;
  development: OpenSearchStageConfiguration;
  production: OpenSearchStageConfiguration;
}

export interface SqsQueueDefinition {
  identifier: string;
  visibilityTimeout: {
    interval: 'minutes' | 'hours' | 'days';
    value: number;
  };
  deadLetterQueue?: {
    identifier: string;
    maxReceiveCount: number;
  };
}

export interface S3BucketDefinition {
  identifier: string;
  explicitName?: string;
  websiteIndexDocument?: string;
  websiteErrorDocument?: string;
  publicReadAccess?: boolean;
  cors?: Array<{
    allowedMethods: string[];
    allowedOrigins: string[];
    allowedHeaders?: string[];
  }>;
}

export interface WorkspaceInfrastructureConfig {
  dynamoDB?: {
    tables: Array<DynamoTableDefinition>;
  };
  secrets?: {
    byArn: Record<string, string>;
    generated: string[];
  };
  s3?: {
    buckets: Array<S3BucketDefinition>;
  };
  cdn?: Array<CDNConfig>;
  apps?: Record<string, ProjectInfrastructureConfig>;
}
