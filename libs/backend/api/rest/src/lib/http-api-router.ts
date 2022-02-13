import type {APIGatewayProxyEvent, APIGatewayProxyEventV2, Context} from 'aws-lambda';
import type { Callback } from 'aws-lambda/handler';
import {
  HttpError,
} from './errors/http-error';

export function makeObjectSerializable(obj: unknown) {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Set) {
    return [...obj];
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => makeObjectSerializable(item));
  }

  if (obj instanceof Date) {
    return obj;
  }

  const serializable: unknown = {};
  Object.entries(obj).forEach(([key, val]) => {
    serializable[key] = makeObjectSerializable(val);
  });

  return serializable;
}

export type ApiHandler<EventType, ReturnType> = (
  event: EventType,
  context: Context
) => Promise<ReturnType>;

function makeResponse(payload: unknown, statusCode = 200) {
  payload = makeObjectSerializable(payload);

  return {
    isBase64Encoded: false,
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    multiValueHeaders: {},
    body: JSON.stringify(
      payload ?? { status: statusCode === 200 ? 'ok' : 'error' }
    ),
  };
}

function makeErrorResponse(error: string, statusCode = 500) {
  return makeResponse(
    {
      error,
    },
    statusCode
  );
}

export type ApiHttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'ANY';

export interface Route<ReturnType> {
  method: ApiHttpMethod;
  path: string;
  handler: ApiHandler<APIGatewayProxyEvent, ReturnType>;
}

export function wrapHandler<EventType, ReturnType>(
  callback: ApiHandler<EventType, ReturnType>
) {
  return async (
    event: EventType,
    context: Context,
    lambdaCallback: Callback
  ) => {
    let response: unknown;
    try {
      response = await callback(event, context);
      const transformedResponse = makeResponse(response);
      if (lambdaCallback) {
        lambdaCallback(null, transformedResponse);
        return;
      }
      return transformedResponse;
    } catch (e) {
      let message = e as string;
      let httpStatusCode = 500;

      if (e instanceof Error) {
        message = e.message;
      }

      if (e instanceof HttpError) {
        httpStatusCode = e.httpStatusCode;
      }

      const errorResponse = makeErrorResponse(message, httpStatusCode);

      console.error({
        errorResponse,
        originalResponse: response,
        originalError: {
          ...e,
          name: e.name,
          message: e.message,
          stack: e.stack,
          httpStatusCode: e.httpStatusCode ?? 'not-given',
        },
      });
      if (lambdaCallback) {
        lambdaCallback(null, errorResponse);
        return;
      }

      return errorResponse;
    }
  };
}

export class HttpApiRouter {
  public routes: Route<unknown>[] = [];
  private readonly sessionTokenArn?: string;

  public constructor(sessionTokenArn?: string) {
    this.sessionTokenArn = sessionTokenArn;
  }

  private addRoute<ReturnType>(
    method: ApiHttpMethod,
    path: string,
    handler: ApiHandler<APIGatewayProxyEvent, ReturnType>,
  ) {
    this.routes.push({
      method,
      path,
      handler,
    });
  }

  public addRoutes() {
    const makeAddRouteFunction =
      <ReturnType>(method: ApiHttpMethod) =>
      (
        path: string,
        handler: ApiHandler<APIGatewayProxyEvent, ReturnType>,
      ) => {
        this.addRoute(method, path, handler);
        return this.addRoutes();
      };

    return {
      get: makeAddRouteFunction('GET'),
      post: makeAddRouteFunction('POST'),
      put: makeAddRouteFunction('PUT'),
      delete: makeAddRouteFunction('DELETE'),
      any: makeAddRouteFunction('ANY'),
      options: makeAddRouteFunction('OPTIONS'),
      patch: makeAddRouteFunction('PATCH'),
      head: makeAddRouteFunction('HEAD'),
    };
  }

  public async handler(
    event: APIGatewayProxyEventV2,
    context: Context,
    callback: (error: unknown, result: unknown) => unknown
  ) {
    const [eventHttpMethod, eventPath] = event.routeKey.split(' ');

    console.log('Router', 'request', 'info', {
      event,
      httpMethod: eventHttpMethod,
      path: eventPath,
      rawPath: event.rawPath,
    });

    context.callbackWaitsForEmptyEventLoop = false;

    const route = this.routes.find(
      (r) => r.path === eventPath && r.method === eventHttpMethod
    );

    if (!route) {
      console.log('Router', 'route-not-found', 'error', {
        event,
        routes: this.routes,
      });
      return callback(null, makeErrorResponse('404 Route not found', 404));
    }

    const wrappedHandler = wrapHandler(route.handler.bind(this));

    try {
      let isCalled = false;
      const responsePromise = wrappedHandler(event, context, (error, result) => {
        console.log('Router', 'request', error ? 'error' : 'success', {
          httpMethod: eventHttpMethod,
          resource: eventPath,
          path: event.rawPath,
          error,
          result,
        });

        // eslint-disable-next-line no-console
        console.log('now calling callback');

        !isCalled && callback(error, result);
        isCalled = true;
      }) as Promise<unknown> | unknown;

      if (typeof (responsePromise as Promise<unknown>).then === 'function') {
        // eslint-disable-next-line no-console
        console.log('handler is promise, awaiting response');
        const response = await responsePromise;

        console.log('Router', 'request', 'success', {
          httpMethod: eventHttpMethod,
          resource: eventPath,
          path: event.rawPath,
          response,
        });

        // eslint-disable-next-line no-console
        console.log('promise done, calling callback');
        !isCalled && callback(null, response);
        isCalled = true;
      }
    } catch (e) {
      console.log('Router', 'request', 'error', {
        httpMethod: eventHttpMethod,
        resource: eventPath,
        path: event.rawPath,
        error: {
          name: e.name,
          message: e.message,
          stack: e.stack,
        },
      });

      if (e instanceof HttpError) {
        callback(null, makeErrorResponse(e.message, e.httpStatusCode));
      } else {
        callback(null, makeErrorResponse('Server Error', 500));
      }
    }
  }
}
