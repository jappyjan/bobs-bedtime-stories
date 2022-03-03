import {
  aws_route53 as route53,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  DefaultStackProps,
  getSharedHostedZone,
} from '../utils/shared';
import StaticSiteStack from './frontend/static-site-stack';
import {Construct} from "constructs";

interface Props extends DefaultStackProps {
  backendStackName: string;
}

export default class FrontendStack extends Stack {
  private readonly props: Props & StackProps;
  private readonly hostedZone: route53.HostedZone;

  private constructor(
    construct: Construct,
    id: string,
    props: Props & StackProps
  ) {
    super(construct, id, props);

    this.props = props;

    this.hostedZone = getSharedHostedZone(this, 'HostedZone');
  }

  public static async create(
    construct: Construct,
    id: string,
    props: Props & StackProps
  ) {
    const stack = new FrontendStack(construct, id, props);
    await stack.init();
    return stack;
  }

  private async init() {
    await StaticSiteStack.create(this, 'StaticSites', {
      ...this.props,
      hostedZone: this.hostedZone,
    });
  }
}
