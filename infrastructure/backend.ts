#!/usr/bin/env node
import {App} from 'aws-cdk-lib';
import 'source-map-support/register';
import { BackendStack } from './stacks/backend-stack';
import { getSharedProps } from './utils/shared';
import { getStackName } from './utils/stack-name';

export async function makeBackend() {
  process.env._IS_CDK_BUILD = 'TRUE';
  const { defaultStackProps } = getSharedProps();
  const backendStackName = getStackName('backend');

  const app = new App();
  await BackendStack.create(app, backendStackName, defaultStackProps);
}

makeBackend().catch((e) => {
  console.error(e);
  process.exit(-1);
});
