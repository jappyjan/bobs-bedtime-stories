import type { StaticSiteConfig } from '../stacks/frontend/static-site-stack';

export interface ProjectLambdaSecretConfig {
  arn?: string;
  name?: string;
}

export interface ProjectLambdaSqsHandlerConfig {
  batchSize?: number;
  maxBatchingWindow?: {
    interval: 'minutes' | 'seconds' | 'millis';
    duration: number;
  };
}

export interface ProjectLambdaSqsQueueConfig {
  identifier: string;
  permissions?: ('SendMessages' | 'ConsumeMessages')[];
  handler?: ProjectLambdaSqsHandlerConfig;
}

export interface ProjectLambdaSqsConfig {
  queues: ProjectLambdaSqsQueueConfig[];
}

export interface ProjectLambdaDynamoStreamHandlerConfig {
  identifier: string;
  tableIdentifier: string;
  deadLetterQueueOnFailure: boolean;
  batchSize: number;
  maxBatchingWindow?: {
    interval: 'minutes' | 'seconds' | 'millis';
    duration: number;
  };
  bisectBatchOnError: boolean;
  retryAttempts: number;
}

export interface ProjectLambdaConfig {
  identifier?: string;
  timeout?: {
    interval: 'minutes' | 'seconds';
    value: number;
  };
  buildCommandOverwrite?: string;
  buildCommandOverwriteWatchMode?: string;
  buildConfiguration?: string;
  memorySize?: number;
  alarms: Array<{
    identifier: string;
    description: string;
    threshold: number;
    evaluationPeriods: number;
    metric: 'errors';
  }>;
  dynamoDb?: {
    readWrite?: string[];
  };
  s3?: {
    buckets?: {
      readWrite?: string[];
    };
  };
  secrets?: string[];
  dynamicRestApi?: {
    file: string;
    exportName: string;
  };
  codePath: string;
  handler: string;
  reservedConcurrentExecutions?: number;
  env?: {
    static?: Record<string, string>;
    dynamic?: {
      dynamoDb?: Record<
        string,
        {
          tableIdentifier: string;
          type: 'tableName';
        }
      >;
      api?: Record<string, 'apiEndpoint'>;
    };
  };
}

export interface ProjectNextJsConfig {
  subdomain: string;
  clearCommand?: string;
  buildCommandOverwrite?: string;
  distFolder: string;
  webAclMetricName: string;
  environment: Record<
    string,
    {
      fromEnv?: string;
    }
  >;
}

export interface ProjectInfrastructureConfig {
  disabled?: boolean;
  lambda?: ProjectLambdaConfig;
  staticSite?: StaticSiteConfig;
  virtualProjects?: {
    identifier: string;
    config: ProjectInfrastructureConfig;
  }[];
  duplicates?: number;
}
