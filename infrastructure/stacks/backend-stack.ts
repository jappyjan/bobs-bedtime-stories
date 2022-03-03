import {
  aws_certificatemanager as certificateManager,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_route53_targets as route53Targets, CfnOutput, Duration, Stack, StackProps,
} from 'aws-cdk-lib';
import * as apiGatewayV2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { makeProjectLogger, ProjectLogger } from '../utils/logger';
import {
  forEachProject,
  ProjectCallbackArgs,
} from '../utils/project-infrastructure-config';
import {
  DefaultStackProps,
  getSharedHostedZone,
} from '../utils/shared';
import CdnStack, { CDNConfig } from './backend/cdn-stack';
import DynamoStack from './backend/dynamo-stack';
import LambdaStack from './backend/lambda-stack';
import S3Stack from './backend/s3-stack';
import SecretsStack from './backend/secrets-stack';
import {Construct} from "constructs";
import {workspaceInfrastructureConfig} from "../utils/workspace-root-dir";

export class BackendStack extends Stack {
  private httpApi: apiGatewayV2.HttpApi;
  private dynamoStack: DynamoStack;
  private secretsStack: SecretsStack;
  private isInitiated = false;
  private s3Stack: S3Stack;
  private readonly hostedZone: route53.HostedZone;
  private readonly logger: ProjectLogger;
  private readonly props: DefaultStackProps;
  private cloudfrontDistributions: Record<string, cloudfront.Distribution> = {};

  private constructor(
    scope: Construct,
    id: string,
    props: StackProps & DefaultStackProps
  ) {
    super(scope, id, props);

    this.props = props;
    this.logger = makeProjectLogger('MAIN');

    this.hostedZone = getSharedHostedZone(this, 'HostedZone');
  }

  public static async create(
    scope: Construct,
    id: string,
    props: StackProps & DefaultStackProps
  ) {
    const stack = new BackendStack(scope, id, props);
    await stack.init();

    return stack;
  }

  public async init() {
    if (this.isInitiated) {
      throw new Error('NftMarketplaceStack is already initiated');
    }

    const apiDomainName = `api.${this.props.rootDomain}`;
    this.logger('creating httpApi for domain', apiDomainName);

    const apiCertificate = new certificateManager.DnsValidatedCertificate(
      this,
      'ApiCertificate',
      {
        domainName: apiDomainName,
        hostedZone: this.hostedZone,
        region: 'eu-central-1',
      }
    );

    const apiDomain = new apiGatewayV2.DomainName(this, 'ApiDomainName', {
      domainName: apiDomainName,
      certificate: apiCertificate,
    });

    this.httpApi = new apiGatewayV2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [apiGatewayV2.CorsHttpMethod.ANY],
        allowOrigins: ['*'],
        maxAge: Duration.days(10),
      },
      defaultDomainMapping: {
        domainName: apiDomain,
      },
    });

    new route53.ARecord(this, 'ApiDNSAlias', {
      recordName: apiDomainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGatewayv2DomainProperties(
          apiDomain.regionalDomainName,
          apiDomain.regionalHostedZoneId
        )
      ),
      zone: this.hostedZone,
    });

    new CfnOutput(this, 'apiEndpoint', { value: apiDomainName });

    this.dynamoStack = new DynamoStack(this, 'Dynamo', {
      ...this.props,
      logger: this.logger,
    });

    this.secretsStack = new SecretsStack(this, 'Secrets', {
      ...this.props,
      logger: this.logger,
    });

    this.s3Stack = new S3Stack(this, 'S3', {
      ...this.props,
      logger: this.logger,
    });

    const makeCdnStack = async (cdnConfig: CDNConfig) => {
      const cdnIdentifier = `${cdnConfig.identifier}CDN`;
      const cdnLogger = makeProjectLogger(cdnIdentifier);
      const cdnStack = await CdnStack.create(this, cdnIdentifier, {
        ...this.props,
        logger: cdnLogger,
        config: cdnConfig,
        s3Stack: this.s3Stack,
        httpApi: this.httpApi,
        hostedZone: this.hostedZone,
      });
      this.cloudfrontDistributions[cdnConfig.identifier] =
        cdnStack.distribution;
    };
    await Promise.all(
      (workspaceInfrastructureConfig.cdn as CDNConfig[]).map((cdnConfig) => {
        return makeCdnStack(cdnConfig);
      })
    );

    await forEachProject(async (props) => {
      this.logger('setup project', props.projectName);
      await this.setupProject(props);
      this.logger('project created successfully');
    });

    this.isInitiated = true;
  }

  private async setupProject(props: ProjectCallbackArgs) {
    const { config, projectName } = props;

    const logger = makeProjectLogger(projectName);

    if (config.lambda) {
      await LambdaStack.create(this, `${projectName}-Lambda`, {
        ...this.props,
        logger,
        config: config.lambda,
        dynamoDbTables: this.dynamoStack.tables,
        secrets: this.secretsStack.secrets,
        httpApi: this.httpApi,
        projectName,
        s3Buckets: this.s3Stack.buckets,
      });
    }
  }
}
