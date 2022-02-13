import {aws_s3 as s3, NestedStack, NestedStackProps} from 'aws-cdk-lib';
import { ProjectLogger } from '../../utils/logger';
import { DefaultStackProps } from '../../utils/shared';
import { getStackName } from '../../utils/stack-name';
import {Construct} from "constructs";
import {workspaceInfrastructureConfig} from "../../utils/workspace-root-dir";

interface Props extends DefaultStackProps {
  logger: ProjectLogger;
}

interface BucketConfig {
  identifier: string;
  explicitName?: string;
  blockPublicAccess?: keyof typeof s3.BlockPublicAccess;
  websiteIndexDocument?: string;
  websiteErrorDocument?: string;
  publicReadAccess?: boolean;
  cors?: Array<{
    allowedMethods: s3.HttpMethods[];
    allowedOrigins: string[];
    allowedHeaders: string[];
  }>;
}

export default class S3Stack extends NestedStack {
  public buckets: Record<string, s3.Bucket> = {};
  private readonly logger: ProjectLogger;

  constructor(
    scope: Construct,
    id: string,
    props: Props & NestedStackProps
  ) {
    super(scope, id, props);

    const { resourcesRemovalPolicy, logger } = props;
    this.logger = logger;

    workspaceInfrastructureConfig.s3.buckets.forEach((conf) => {
      const bucketConfig = conf as BucketConfig;

      this.logger('creating S3 Bucket', bucketConfig.identifier);

      let bucketName: string | undefined = undefined;
      if (bucketConfig.explicitName) {
        bucketName = bucketConfig.explicitName
          .replace('{{stack-name}}', getStackName('backend'))
          .toLowerCase();
      }

      this.buckets[bucketConfig.identifier] = new s3.Bucket(
        this,
        `${bucketConfig.identifier}Bucket`,
        {
          bucketName,
          removalPolicy: resourcesRemovalPolicy,
          blockPublicAccess: bucketConfig.blockPublicAccess
            ? s3.BlockPublicAccess[
                bucketConfig.blockPublicAccess as keyof typeof s3.BlockPublicAccess
              ]
            : undefined,
          websiteIndexDocument: bucketConfig.websiteIndexDocument,
          websiteErrorDocument: bucketConfig.websiteErrorDocument,
          publicReadAccess: bucketConfig.publicReadAccess,
          autoDeleteObjects: false,
          cors: bucketConfig.cors,
        }
      );
    });
  }
}
