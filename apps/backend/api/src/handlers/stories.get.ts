import {makeStoryModel} from '@bobs-bedtime-stories/dynamoose';
import {wrapApiHandler} from '../utils/wrap-api-handler';

export const getStoriesOfBook = wrapApiHandler(async (event) => {
  const bookSlug = event.pathParameters.bookSlug as string;

  return await makeStoryModel().query()
    .attribute('bookSlug')
    .eq(bookSlug)
    .all()
    .exec();
});
