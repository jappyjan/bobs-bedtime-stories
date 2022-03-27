import {authenticate} from './authenticate';
import type {ApiHandler} from "@bobs-bedtime-stories/backend-api-rest";
import {APIGatewayProxyEventV2} from "aws-lambda";

export function wrapApiHandler(handler: ApiHandler<APIGatewayProxyEventV2, unknown>): ApiHandler<APIGatewayProxyEventV2, unknown> {
  return async (event, context) => {
    console.log('authenticating...');
    await authenticate(event);
    console.log('authenticated');

    return handler(event, context);
  };
}
