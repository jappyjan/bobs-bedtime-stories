import {makeStoryModel} from '@bobs-bedtime-stories/dynamoose';
import {wrapApiHandler} from '../utils/wrap-api-handler';
import {environment} from "../environments/environment";
import {nanoid} from "nanoid";
import {BobsS3} from "../../../../../libs/backend/utils/src/lib/s3";

export const postANewEpisode = wrapApiHandler(async (event) => {
  const bookSlug = event.pathParameters.bookSlug as string;

  const storiesSortedByEpisode = await makeStoryModel().query()
    .attribute('bookSlug').eq(bookSlug)
    .sort('descending')
    .limit(1)
    .exec();

  let episode = 1;
  if (storiesSortedByEpisode.length > 0) {
    episode = storiesSortedByEpisode[0].episode + 1;
  }

  const s3Key = `books/${bookSlug}/stories/${episode}/audio/${nanoid(5)}.webm`;

  const s3 = new BobsS3();
  const preSignedUrlData = s3.createPreSignedPost({
    Bucket: environment.cdnBucket,
    Expires: 120,
    Fields: {
      key: s3Key,
    },
  });

  const story = await makeStoryModel().create({
    bookSlug,
    episode,
    date: new Date(),
    audioS3Key: s3Key
  });

  return {
    story,
    audioUploadUrlData: preSignedUrlData,
  };
});
