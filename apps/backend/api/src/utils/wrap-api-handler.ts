import {authenticate} from './authenticate';
import type {ApiHandler} from "@bobs-bedtime-stories/backend-api-rest";
import type {APIGatewayProxyEvent} from "aws-lambda";

export function wrapApiHandler(handler: ApiHandler<APIGatewayProxyEvent, unknown>): ApiHandler<APIGatewayProxyEvent, unknown> {
  return async (event, context) => {
    console.log('authenticating...');
    await authenticate(event);
    console.log('authenticated');

    return handler(event, context);
  };
}
