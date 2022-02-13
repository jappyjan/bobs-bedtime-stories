import {
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_cloudfront_origins as origins,
  CfnOutput,
  NestedStack,
  NestedStackProps,
} from 'aws-cdk-lib';
import {exec} from 'child_process';
import {existsSync, rmSync} from 'fs';
import {join} from 'path';
import {forEachProject} from '../../utils/project-infrastructure-config';
import {DefaultStackProps, getValueFromStackCdkOutput} from '../../utils/shared';
import {workspaceRootDir} from '../../utils/workspace-root-dir';
import {Construct} from "constructs";

export interface StaticSiteConfig {
  subdomain: string;
  distPath: string;
  buildCommandOverwrite?: string;
  buildConfiguration?: string;
  env?: {
    dynamic?: {
      cdkBackendStackOutput: Record<string, string>;
    }
  }
}

interface Props extends DefaultStackProps {
  hostedZone: route53.HostedZone;
}

export default class StaticSiteStack extends NestedStack {
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
    const stack = new StaticSiteStack(construct, id, props);
    await stack.init();
    return stack;
  }

  public async init() {
    await forEachProject(async ({projectName, config}) => {
      if (config.staticSite) {
        await this.setupProject(projectName, config.staticSite);
      }
    });
  }

  private async setupProject(projectName: string, config: StaticSiteConfig) {
    const {rootDomain, hostedZone} = this.props;
    const {subdomain, buildCommandOverwrite, buildConfiguration, env} = config;

    const fullDistPath = join(workspaceRootDir, config.distPath);

    if (existsSync(fullDistPath)) {
      rmSync(fullDistPath, {recursive: true, force: true});
    }

    let buildCommand = buildCommandOverwrite as string;
    if (!buildCommandOverwrite) {
      buildCommand = `nx build ${projectName}`;

      if (buildConfiguration) {
        buildCommand += ` --configuration ${buildConfiguration}`;
      }
    }

    const buildEnv: Record<string, string> = {};
    Object.entries(env?.dynamic?.cdkBackendStackOutput ?? {}).forEach(
      ([key, attribute]) => {
        const value = getValueFromStackCdkOutput('backend', attribute, false);

        if (!value) {
          throw new Error(`Unknown attribute type ${attribute}`);
        }

        buildEnv[key] = value;
      }
    );

    await new Promise((resolve, reject) => {
      exec(
        buildCommand,
        {
          cwd: workspaceRootDir,
          env: {
            ...process.env,
            ...buildEnv,
          }
        },
        (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(stdout);
        }
      );
    });

    const domainName = `${subdomain}.${rootDomain}`;
    new CfnOutput(this, `StaticSite${projectName}`, {
      value: 'https://' + domainName,
    });

    const siteBucket = new s3.Bucket(this, `StaticSiteBucket${projectName}`, {
      bucketName: domainName,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: this.props.resourcesRemovalPolicy,
      autoDeleteObjects: true,
    });

    const certificate = new acm.DnsValidatedCertificate(
      this,
      `StaticSiteCertificate${projectName}`,
      {
        domainName,
        hostedZone,
        region: 'us-east-1',
      }
    );

    const distribution = new cloudfront.Distribution(
      this,
      `StaticSiteDistribution${projectName}`,
      {
        domainNames: [domainName],
        certificate,
        defaultBehavior: {
          origin: new origins.S3Origin(siteBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      }
    );

    new route53.ARecord(this, `StaticSiteAliasRecord${projectName}`, {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution)
      ),
      zone: hostedZone,
    });

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(
      this,
      `StaticSiteDeployWithInvalidation${projectName}`,
      {
        sources: [s3deploy.Source.asset(fullDistPath)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/*'],
      }
    );

    new CfnOutput(this.nestedStackParent!, `StaticSiteDomain${projectName}`, {
      value: domainName,
    });
  }
}
