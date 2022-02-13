import {
  aws_certificatemanager as certificateManager,
  aws_cloudfront as cloudfront,
  aws_ec2 as ec2,
  aws_route53 as route53,
  aws_cloudfront_origins as origins,
  aws_route53_targets as route53Targets, NestedStack, NestedStackProps, Duration, CfnOutput,
} from 'aws-cdk-lib';
import * as apiGatewayV2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { ProjectLogger } from '../../utils/logger';
import { DefaultStackProps } from '../../utils/shared';
import S3Stack from './s3-stack';
import {Construct} from "constructs";

export interface CDNConfig {
  identifier: string;
  subdomain: string;
  bucketIdentifier: string;
}

interface Props extends DefaultStackProps {
  config: CDNConfig;
  hostedZone: route53.IHostedZone;
  logger: ProjectLogger;
  s3Stack: S3Stack;
  vpc: ec2.Vpc;
  httpApi: apiGatewayV2.HttpApi;
}

export default class CdnStack extends NestedStack {
  public distribution: cloudfront.Distribution;
  private readonly props: Props;

  private constructor(
    construct: Construct,
    id: string,
    props: NestedStackProps & Props
  ) {
    super(construct, id, props);

    this.props = props;
  }

  public static async create(
    construct: Construct,
    id: string,
    props: NestedStackProps & Props
  ) {
    const stack = new CdnStack(construct, id, props);
    await stack.init();
    return stack;
  }

  private async init() {
    const {
      s3Stack,
      rootDomain,
      config,
      hostedZone,
      logger,
    } = this.props;

    const bucket = s3Stack.buckets[config.bucketIdentifier];

    const domainName = `${config.subdomain}.${rootDomain}`;

    logger('creating CDN-Stack', config.identifier);

    const certificate = new certificateManager.DnsValidatedCertificate(
      this,
      'Certificate',
      {
        domainName,
        hostedZone,
        region: 'us-east-1',
      }
    );

    const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
      defaultTtl: Duration.days(14),
      minTtl: Duration.days(7),
      maxTtl: Duration.days(56),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        compress: true,
        cachePolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
      domainNames: [domainName],
      certificate,
    });

    new route53.ARecord(this, 'DistributionDNSAlias', {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(this.distribution)
      ),
      zone: hostedZone,
    });

    new CfnOutput(this.nestedStackParent!, `${config.identifier}-CDN`, {
      value: domainName,
    });
  }
}
