import {aws_secretsmanager as secretsManager, RemovalPolicy, NestedStack, NestedStackProps} from 'aws-cdk-lib';
import { ProjectLogger } from '../../utils/logger';
import { DefaultStackProps } from '../../utils/shared';
import {Construct} from "constructs";
import {workspaceInfrastructureConfig} from "../../utils/workspace-root-dir";

interface Props extends DefaultStackProps {
  resourcesRemovalPolicy: RemovalPolicy;
  logger: ProjectLogger;
}

export default class SecretsStack extends NestedStack {
  public secrets: Record<string, secretsManager.Secret> = {};
  private readonly logger: ProjectLogger;

  constructor(
    scope: Construct,
    id: string,
    props: Props & NestedStackProps
  ) {
    super(scope, id, props);

    const { resourcesRemovalPolicy: removalPolicy, logger } = props;
    this.logger = logger;

    workspaceInfrastructureConfig.secrets.generated.forEach((identifier) => {
      this.logger('generating secret with name', identifier);
      this.secrets[identifier] = new secretsManager.Secret(
        this,
        `${identifier}Secret`,
        {
          generateSecretString: {},
          removalPolicy: removalPolicy,
        }
      );
    });
    Object.entries(
      workspaceInfrastructureConfig.secrets.byArn
    ).forEach(([identifier, arn]) => {
      this.secrets[identifier] = secretsManager.Secret.fromSecretCompleteArn(
        this,
        `${identifier}Secret`,
        arn as string
      ) as secretsManager.Secret;
    });
  }
}
