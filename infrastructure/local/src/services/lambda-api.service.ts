import { Route } from '@bobs-bedtime-stories/backend-api-rest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import { ProjectLambdaConfig } from '../../../utils/infrastructure-config.types';
import { workspaceRootDir } from '../../../utils/workspace-root-dir';
import { LambdaBaseService } from './lambda-base.service';
import { Env } from './utils/env';
import { ServiceLogger } from './utils/service-logger';

interface LambdaApiServiceParams {
  nxProjectName: string;
  config: ProjectLambdaConfig;
  env: Env;
  port: number;
}

export class LambdaApiService extends LambdaBaseService {
  private readonly nxProjectName: string;
  private static app: Express | null = null;
  private static server: Server | null = null;
  private static readonly services: Map<string, LambdaApiService> = new Map();

  constructor(params: LambdaApiServiceParams) {
    const { nxProjectName, config, env, port } = params;

    if (!config.dynamicRestApi) {
      throw new Error('No rest api configuration found');
    }

    super({
      config,
      logger: new ServiceLogger('API', nxProjectName),
      apiPort: port,
      env,
      nxProjectName,
    });

    LambdaApiService.services.set(nxProjectName, this);

    this.nxProjectName = nxProjectName;
  }

  public async init() {
    this.logger.log('Starting...');

    await super.init();

    if (!LambdaApiService.app) {
      this.logger.log('Creating express app');
      LambdaApiService.app = express();
      LambdaApiService.app.use(cors());
      LambdaApiService.app.use(LambdaApiService.handleRequest);
      LambdaApiService.server = LambdaApiService.app.listen(this.apiPort);
    }

    const serverAddress = LambdaApiService.server?.address() as AddressInfo;
    const previousPort = serverAddress?.port;
    if (previousPort !== this.apiPort) {
      throw new Error(
        `LambdaApiService: port ${this.apiPort} cannot change from ${previousPort}`
      );
    }

    this.logger.log('Started');
  }

  private static convertAwsPathToExpressPath = (path: string) => {
    return path.replace(/\{(\w+)\}/g, ':$1');
  };

  private static async handleRequest(
    req: Request,
    res: Response
  ): Promise<void> {
    const matchingLambda = [...LambdaApiService.services.values()]
      .map((service) => {
        const config = service.config;
        const routesFileName = config.dynamicRestApi!.file;
        const routesExportName = config.dynamicRestApi!.exportName;

        let routes: Route<unknown>[] | undefined = undefined;
        try {
          const routesFile = require(join(workspaceRootDir, routesFileName));
          routes = routesFile[routesExportName] as Route<unknown>[] | undefined;
        } catch (e) {
          service.logger.log(
            `${config.buildCommandOverwrite} - no routes file`
          );
        }

        if (!routes) {
          service.logger.log(
            `${config.buildCommandOverwrite} - no routes export`
          );
          return false;
        }

        const matchingRoute = routes.find((route) => {
          const expressPathParts = req.path
            .split('/')
            .filter((part) => part !== '');
          const awsPathAsExpressPath =
            LambdaApiService.convertAwsPathToExpressPath(route.path);
          const awsRoutePathParts = awsPathAsExpressPath
            .split('/')
            .filter((part) => part !== '');

          if (awsRoutePathParts.length !== expressPathParts.length) {
            return false;
          }

          const pathsDoMatch = expressPathParts.every((expressPart, index) => {
            const awsPart = awsRoutePathParts[index];
            // if part is a variable we don't care
            if (awsPart?.startsWith(':')) {
              return true;
            }

            // otherwise, we have to make sure it's an exact match
            return expressPart === awsPart;
          });

          return (
            pathsDoMatch &&
            req.method.toLowerCase() === route.method.toLowerCase()
          );
        });

        if (!matchingRoute) {
          return false;
        }

        return { service, route: matchingRoute };
      })
      .find(Boolean);

    if (!matchingLambda) {
      res.status(404).send('Route not found');
      return;
    }

    const { service, route } = matchingLambda;

    const event = await LambdaApiService.convertExpressRequestToApiGatewayEvent(
      req,
      route
    );

    const result = await service
      .executeHandler<{ body: string; statusCode?: number }>(event)
      .catch((e) => ({
        body: JSON.stringify({
          name: (e as Error).name,
          message: (e as Error).message,
          stack: (e as Error).stack,
        }),
        statusCode: 500,
      }));

    res.status(result.statusCode ?? 200).send(result.body);
  }

  private static async convertExpressRequestToApiGatewayEvent(
    req: Request,
    routeDefinition: Route<unknown>
  ): Promise<APIGatewayProxyEvent> {
    const mixedValueObjectToSingleValueObject = (
      value: Record<string, unknown> | Record<string, unknown[]>,
      shallBeMultiValue: boolean
    ) => {
      return Object.fromEntries(
        Object.entries(value).filter(
          ([, value]) => shallBeMultiValue === Array.isArray(value)
        )
      );
    };

    // extract path parameters by comparing the path with the route definition
    const routePathParts = LambdaApiService.convertAwsPathToExpressPath(
      routeDefinition.path
    )
      .split('/')
      .filter((part) => part !== '');
    const expressPathParts = req.path.split('/').filter((part) => part !== '');
    const pathParameters = Object.fromEntries(
      routePathParts.map((routePart, index) => {
        if (routePart.startsWith(':')) {
          return [routePart.substring(1), expressPathParts[index]];
        }
        return [routePart, expressPathParts[index]];
      })
    );

    let rawBody = '';
    req.setEncoding('utf8');

    req.on('data', function (chunk) {
      rawBody += chunk;
    });

    await new Promise<void>((resolve) => {
      req.on('end', function () {
        resolve();
      });
    });

    return {
      isBase64Encoded: false,
      path: req.path,
      httpMethod: req.method.toUpperCase(),
      headers: mixedValueObjectToSingleValueObject(
        req.headers,
        false
      ) as APIGatewayProxyEvent['headers'],
      multiValueHeaders: mixedValueObjectToSingleValueObject(
        req.headers,
        true
      ) as APIGatewayProxyEvent['multiValueHeaders'],
      body: rawBody,
      pathParameters,
      queryStringParameters: mixedValueObjectToSingleValueObject(
        req.query,
        false
      ) as APIGatewayProxyEvent['queryStringParameters'],
      multiValueQueryStringParameters: mixedValueObjectToSingleValueObject(
        req.query,
        true
      ) as APIGatewayProxyEvent['multiValueQueryStringParameters'],
      resource: routeDefinition.path,
      stageVariables: null,
      requestContext: null as unknown as APIGatewayProxyEvent['requestContext'],
    };
  }

  public async destroy() {
    await super.destroy();

    if (LambdaApiService.server) {
      this.logger.log('Stopping...');
      LambdaApiService.server.close();
      LambdaApiService.server = null;
    }
  }
}
