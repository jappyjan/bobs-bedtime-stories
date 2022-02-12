import {BookModel} from '@bobs-bedtime-stories/dynamoose';
import {bobify} from "../utils/bobified-handler";

export const handler = bobify(async () => {
  const scanAction = BookModel.scan();
  scanAction.all();

  const books = await scanAction.exec();

  return {
    statusCode: 200,
    body: JSON.stringify(books),
  };
});
