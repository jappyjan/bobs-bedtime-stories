import 'source-map-support/register';
import { LocalStack } from './local-stack';

process.on('unhandledRejection', (error, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', error);
  // application specific logging, throwing an error, or other logic here
  if (error instanceof Error) {
    console.log(error.name);
    console.log(error.stack);
    process.exit(1);
  }
});

LocalStack.createAndInit().catch((e) => {
  console.error(e);
  process.exit(1);
});
