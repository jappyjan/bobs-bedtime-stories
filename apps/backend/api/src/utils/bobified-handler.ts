import {withDynamo} from "./with-dynamo";
import {authenticate} from "./authenticate";

type Handler = (event: any, context: any) => Promise<any>;

export function bobify(handler: Handler) {
  withDynamo();
  return async (event: any, context: unknown) => {
    try {
      authenticate(event);
    } catch (e) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'Unauthorized',
        }),
      };
    }

    return await handler(event, context);
  };
}
