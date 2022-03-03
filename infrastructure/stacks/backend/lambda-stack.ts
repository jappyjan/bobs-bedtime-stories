import {
  aws_dynamodb as dynamo,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_secretsmanager as secretsManager,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_cloudwatch as cloudwatch, Duration,
} from 'aws-cdk-lib';
import * as apiGatewayV2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apiGatewayIntegrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import {exec} from 'child_process';
import {join} from 'path';
import {ProjectLambdaConfig} from '../../utils/infrastructure-config.types';
import {ProjectLogger} from '../../utils/logger';
import {DefaultStackProps} from '../../utils/shared';
import {workspaceRootDir} from '../../utils/workspace-root-dir';
import {Construct} from "constructs";

interface Props extends DefaultStackProps {
  config: ProjectLambdaConfig;
  dynamoDbTables: Record<string, dynamo.Table>;
  projectName: string;
  secrets: Record<string, secretsManager.ISecret>;
  httpApi: apiGatewayV2.HttpApi;
  s3Buckets: Record<string, s3.Bucket>;
  logger: ProjectLogger;
}

export default class LambdaStack extends NestedStack {
  private readonly config: ProjectLambdaConfig;
  private readonly codePath: string;
  private readonly dynamoDbTables: Record<string, dynamo.Table>;
  private readonly projectName: string;
  private readonly resourcesLogRetention: logs.RetentionDays;
  public projectFunction: lambda.IFunction
  private readonly secrets: Record<string, secretsManager.ISecret>;
  private readonly httpApi: apiGatewayV2.HttpApi;
  private readonly s3Buckets: Record<string, s3.Bucket>;
  private readonly logger: ProjectLogger;
  private readonly environmentVariables: Record<string, string> = {};
  private readonly resourcesRemovalPolicy: RemovalPolicy;
  private role: iam.Role;

  private constructor(
    scope: Construct,
    id: string,
    props: Props & NestedStackProps
  ) {
    super(scope, id, props);

    const {
      config,
      dynamoDbTables,
      projectName,
      secrets,
      httpApi,
      s3Buckets,
      logger,
      resourcesRemovalPolicy,
      resourcesLogRetention,
    } = props;

    this.logger = logger;

    logger('creating LambdaStack');

    this.config = config;
    this.dynamoDbTables = dynamoDbTables;
    this.projectName = projectName;
    this.resourcesLogRetention = resourcesLogRetention;
    this.resourcesRemovalPolicy = resourcesRemovalPolicy;
    this.secrets = secrets;
    this.httpApi = httpApi;
    this.s3Buckets = s3Buckets;

    this.codePath = join(workspaceRootDir, this.config.codePath);
  }

  public static async create(
    scope: Construct,
    id: string,
    props: Props & NestedStackProps
  ) {
    const stack = new LambdaStack(scope, id, props);
    await stack.init();
    return stack;
  }

  private async init() {
    this.setupDynamicEnv();
    this.setupStaticEnv();
    await this.buildProject();

    await this.createFunction();
    this.setupDynamoDb();
    this.setupS3();
    this.setupSecrets();

    this.logger(
      `setting env - ${JSON.stringify(this.environmentVariables, null, 4)}`
    );
    Object.keys(this.environmentVariables).forEach((envName) => {
      envName = envName.split('-').join('_');

      (this.projectFunction as lambda.Function).addEnvironment(
        envName,
        this.environmentVariables[envName]
      );
    });

    this.setupDynamicRestApi();
  }

  private async buildProject() {
    const {buildCommandOverwrite, buildConfiguration} = this.config;

    let buildCommand = `nx build ${this.projectName} --skip-nx-cache`;
    if (buildConfiguration) {
      buildCommand += ` --configuration ${buildConfiguration}`;
    }

    if (buildCommandOverwrite) {
      buildCommand = buildCommandOverwrite;
    }

    await new Promise((resolve, reject) => {
      exec(
        buildCommand,
        {
          cwd: workspaceRootDir,
          env: {
            ...process.env,
            ...this.environmentVariables,
          },
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
  }

  private async createFunction() {
    let functionName: string | undefined = undefined;
    if (this.config.identifier) {
      functionName = this.config.identifier;

      if (functionName.length > 64) {
        throw new Error(
          `Combined FunctionName must be less or equal to 64 characters long: ${functionName}`
        );
      }
    }

    this.role = new iam.Role(this, `${this.projectName}-Function-Role`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      )
    );
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaVPCAccessExecutionRole'
      )
    );

    this.role.assumeRolePolicy!.addStatements(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ServicePrincipal('lambda.amazonaws.com'),
          new iam.ServicePrincipal('edgelambda.amazonaws.com'),
        ],
      })
    );

    this.role!.grant(new iam.ServicePrincipal('edgelambda.amazonaws.com'));

    this.projectFunction = new lambda.Function(
      this,
      `${this.projectName}-Function`,
      {
        handler: this.config.handler,
        code: lambda.Code.fromAsset(this.codePath),
        runtime: lambda.Runtime.NODEJS_14_X,
        functionName,
        logRetention: this.resourcesLogRetention,
        timeout: this.config.timeout
          ? Duration[this.config.timeout.interval](
            this.config.timeout.value
          )
          : Duration.seconds(30),
        memorySize: this.config.memorySize,
        reservedConcurrentExecutions: this.config.reservedConcurrentExecutions,
        role: this.role,
      }
    );

    (this.config.alarms ?? []).forEach((alarmConfig) => {
      let metric: cloudwatch.Metric | null = null;
      if (alarmConfig.metric === 'errors') {
        metric = this.projectFunction.metricErrors({
          color: '#ff0000',
        });
      }

      if (!metric) {
        throw new Error(`Unknown Metric: ${alarmConfig.metric}`);
      }

      metric.createAlarm(
        this,
        `${this.projectName}${alarmConfig.identifier}Alarm`,
        {
          alarmDescription: alarmConfig.description,
          threshold: alarmConfig.threshold,
          evaluationPeriods: alarmConfig.evaluationPeriods,
        }
      );
    });
  }

  private setupDynamoDb() {
    Object.keys(this.dynamoDbTables).forEach((tableName) => {
      this.logger('adding dynamo table name to ENV', tableName);
      this.environmentVariables[`DYNAMO_TABLE_${tableName}`] =
        this.dynamoDbTables[tableName].tableName;
    });

    (this.config.dynamoDb?.readWrite ?? []).forEach((tableName) => {
      this.logger('granting full access for dynamo table', tableName);
      const table = this.dynamoDbTables[tableName];
      if (!table) {
        throw new Error(`Unknown DynamoDB table: ${tableName}`);
      }
      table.grantFullAccess(this.role);
    });

    Object.values(this.dynamoDbTables).forEach((table) => {
      table.grant(this.role, 'dynamodb:DescribeTable');
    });
  }

  private setupS3() {
    Object.keys(this.s3Buckets).forEach((bucketIdentifier) => {
      this.logger('adding s3 bucket name to ENV', bucketIdentifier);
      const bucket = this.s3Buckets[bucketIdentifier];
      this.environmentVariables[`S3_BUCKET_${bucketIdentifier}`] =
        bucket.bucketName;
    });

    (this.config.s3?.buckets?.readWrite ?? []).forEach((bucketIdentifier) => {
      this.logger('granting s3 bucket read permission', bucketIdentifier);
      const bucket = this.s3Buckets[bucketIdentifier];
      bucket.grantReadWrite(this.role);
    });
  }

  private setupSecrets() {
    const secrets: ProjectLambdaConfig['secrets'] = this.config.secrets ?? [];

    secrets.forEach((secretIdentifier) => {
      const secret = this.secrets[secretIdentifier];

      if (!secret) {
        throw new Error(
          `Unknown Secret to add to lambda: ${this.projectName} -> ${secretIdentifier}`
        );
      }

      this.logger('granting secret read', secretIdentifier);
      secret.grantRead(this.role);

      const secretEnvKey = `SECRET_${secretIdentifier}_ARN`;
      this.logger('adding secret arn to ENV', secretEnvKey);
      this.environmentVariables[secretEnvKey] =
        secret.secretFullArn ?? secret.secretArn;
    });
  }

  private setupDynamicEnv() {
    const dynamoDbDynamicEnvConfig = this.config?.env?.dynamic?.dynamoDb;
    if (dynamoDbDynamicEnvConfig) {
      Object.keys(dynamoDbDynamicEnvConfig).forEach((envName) => {
        const envConfig = dynamoDbDynamicEnvConfig[envName];
        if (!envConfig) {
          return;
        }

        const table = this.dynamoDbTables[envConfig.tableIdentifier];
        if (!table) {
          throw new Error(
            `DynamoDB Table "${envConfig.tableIdentifier}" not found`
          );
        }

        let value: string;
        switch (envConfig.type) {
          case 'tableName':
            value = table.tableName;
            break;

          default:
            throw new Error(`Unknown DynamoDB env type: ${envConfig.type}`);
        }

        this.environmentVariables[envName] = value;
      });
    }

    const apiEnvConfig = this.config?.env?.dynamic?.api;
    if (apiEnvConfig) {
      Object.keys(apiEnvConfig).forEach((envName) => {
        const propertyName = apiEnvConfig[envName];
        if (!propertyName) {
          return;
        }

        this.environmentVariables[envName] = this.httpApi[propertyName];
      });
    }
  }

  private setupStaticEnv() {
    const staticEnvConfig = this.config.env?.static;
    if (!staticEnvConfig) {
      return;
    }

    Object.keys(staticEnvConfig).forEach((envName) => {
      this.environmentVariables[envName] = staticEnvConfig[envName];
    });
  }

  private setupDynamicRestApi() {
    if (!this.config.dynamicRestApi) {
      return;
    }

    const filePath = join(workspaceRootDir, this.config.dynamicRestApi.file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires

    const file = require(filePath);

    if (!file) {
      throw new Error(`Dynamic Rest API export file not found at: ${filePath}`);
    }

    const routes = file[this.config.dynamicRestApi.exportName] as Array<{
      method: apiGatewayV2.HttpMethod;
      path: string;
    }>;

    if (routes.length === 0) {
      return;
    }

    const projectFunctionGatewayIntegration = new apiGatewayIntegrations.HttpLambdaIntegration(
      `${this.projectName}-integration`,
      this.projectFunction,
      {
        payloadFormatVersion: apiGatewayV2.PayloadFormatVersion.VERSION_2_0,
      });

    routes.forEach((route) => {
      this.httpApi.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: projectFunctionGatewayIntegration,
      });
    });
  }
}
