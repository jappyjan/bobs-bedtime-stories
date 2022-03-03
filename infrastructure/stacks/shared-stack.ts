import {
  aws_route53 as route53,
  CfnOutput,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {DefaultStackProps, getSharedProps} from '../utils/shared';
import {Construct} from "constructs";

export default class SharedStack extends Stack {
  constructor(
    construct: Construct,
    id: string,
    props: DefaultStackProps & StackProps
  ) {
    super(construct, id, props);

    const rootDomain = getSharedProps().defaultStackProps.rootDomain;
    const hostedZone = new route53.HostedZone(this, 'RootDomainHostedZone', {
      zoneName: rootDomain,
    });

    new CfnOutput(this, 'hostedZoneName', {value: hostedZone.zoneName});
    new CfnOutput(this, 'hostedZoneId', {value: hostedZone.hostedZoneId});
  }
}
