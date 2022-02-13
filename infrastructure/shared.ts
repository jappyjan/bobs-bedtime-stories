#!/usr/bin/env node
import {App} from 'aws-cdk-lib';
import 'source-map-support/register';
import SharedStack from './stacks/shared-stack';
import { getSharedProps } from './utils/shared';
import { getStackName } from './utils/stack-name';

export async function makeShared() {
  process.env._IS_CDK_BUILD = 'TRUE';
  const { defaultStackProps } = getSharedProps();
  const stackName = getStackName('shared');

  const app = new App();
  new SharedStack(app, stackName, defaultStackProps);
}

makeShared().catch((e) => {
  console.error(e);
  process.exit(-1);
});
