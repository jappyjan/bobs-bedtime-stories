import {
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_route53 as route53,
  RemovalPolicy
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getStackName } from './stack-name';

export interface DefaultStackProps {
  env: {
    account: string | undefined;
    region: string | undefined;
  } & Record<string, string | undefined>;
  resourcesLogRetention: logs.RetentionDays;
  resourcesRemovalPolicy: RemovalPolicy;
  rootDomain: string;
}

export function getSharedProps() {
  const appType = process.env.APP_TYPE;
  if (!appType) {
    throw new Error(
      'Please provide "APP_TYPE" ENV Variable like "backend" or "frontend"'
    );
  }

  const resourcesRemovalPolicy = RemovalPolicy.DESTROY;
  const resourcesLogRetention = logs.RetentionDays.TWO_WEEKS;

  const rootDomain = 'bob-time-stories.de';

  console.log('using rootDomain', rootDomain);

  const defaultStackProps: DefaultStackProps = {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    resourcesLogRetention,
    resourcesRemovalPolicy,
    rootDomain,
  };

  return {
    defaultStackProps,
    appType,
  };
}

export function getValueFromStackCdkOutput(stack: 'backend' | 'frontend' | 'shared', key: string, silent = true) {
  const stackName = getStackName(stack);

  const cdkOutFilePath = join(
    __dirname,
    '..',
    '..',
    `cdk.${stackName}.out.json`
  );

  let stackOutput: Record<string, Record<string, string>> = {
    [stackName]: {
      [key]: `!!! ERROR: cdk-${stack}-out-file does not exist !!!`,
    },
  };

  if (existsSync(cdkOutFilePath)) {
    stackOutput = JSON.parse(
      readFileSync(cdkOutFilePath).toString()
    );
  } else {
    const errorMessage = `cdk-${stack}-out-file does not exist`;
    if (!silent) {
      throw new Error(errorMessage);
    }
    console.warn(errorMessage);
  }

  return stackOutput[stackName][key];
}

function getValueFromSharedStackCdkOutput(key: string) {
  return getValueFromStackCdkOutput('shared', key);
}

export function getSharedHostedZone(
  scope: Construct,
  id: string,
) {
  return route53.HostedZone.fromHostedZoneAttributes(scope, id, {
    zoneName: getSharedProps().defaultStackProps.rootDomain,
    hostedZoneId: 'Z09860133LATIXGX1YUOE',
  }) as route53.HostedZone;
}

export function getSharedVpc(
  scope: Construct,
  id: string,
): ec2.Vpc {
  return ec2.Vpc.fromLookup(scope, id, {
    vpcId: getValueFromSharedStackCdkOutput('vpcId'),
  }) as ec2.Vpc;
}
