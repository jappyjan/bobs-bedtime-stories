import {makeBookModel} from '@bobs-bedtime-stories/dynamoose';
import {wrapApiHandler} from '../utils/wrap-api-handler';

export const getBooks = wrapApiHandler(async () => {
  console.log('get books');
  const scanAction = makeBookModel().scan();
  console.log('add "all" option')
  scanAction.all();

  console.log('execute');
  const books = await scanAction.exec();
  console.log('done', books);
  return books;
});
