import {StoryModel} from '@bobs-bedtime-stories/dynamoose';
import {bobify} from "../utils/bobified-handler";

export const handler = bobify(async (event: any) => {
  const bookSlug = event.pathParameters.bookSlug as string;

  const stories = await StoryModel.query()
    .attribute('bookSlug')
    .eq(bookSlug)
    .all()
    .exec();

  return {
    statusCode: 200,
    body: JSON.stringify(stories),
  };
});
