#!/usr/bin/env node
import {App} from 'aws-cdk-lib';
import 'source-map-support/register';
import FrontendStack from './stacks/frontend-stack';
import { getSharedProps } from './utils/shared';
import { getStackName } from './utils/stack-name';

export async function makeFrontend() {
  process.env._IS_CDK_BUILD = 'TRUE';
  const { defaultStackProps } = getSharedProps();
  const backendStackName = getStackName('backend');
  const frontendStackName = getStackName('frontend');

  const app = new App();

  await FrontendStack.create(app, frontendStackName, {
    ...defaultStackProps,
    backendStackName,
  });
}

makeFrontend().catch((e) => {
  console.error(e);
  process.exit(-1);
});
