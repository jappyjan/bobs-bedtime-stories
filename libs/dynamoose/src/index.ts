export * from './lib/story.model';
export * from './lib/book.model';

import { aws } from 'dynamoose';

if (process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true') {
  aws.ddb.local();
}
