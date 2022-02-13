import {wrapApiHandler} from '../utils/wrap-api-handler';

export const verifyPasscode = wrapApiHandler(async () => {
  return {
    status: 'OK',
  }
});
