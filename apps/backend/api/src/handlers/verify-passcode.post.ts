import {bobify} from "../utils/bobified-handler";

export const handler = bobify(async () => {
  return {
    statusCode: 200,
    body: JSON.stringify('OK'),
  };
});
