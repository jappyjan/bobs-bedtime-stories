import {environment} from "../environments/environment";
import {DynamoDB} from "aws-sdk";
import {aws} from "dynamoose";

export function withDynamo() {
  // when dev, use local dynamo with dynamoose
  if (environment.offline) {
    console.log('is offline, using local dynamo');
    const awsDynamoClient = new DynamoDB({
      region: 'localhost',
      endpoint: 'http://localhost:8000',
      accessKeyId: 'DEFAULT_ACCESS_KEY',  // needed if you don't have aws credentials at all in env
      secretAccessKey: 'DEFAULT_SECRET' // needed if you don't have aws credentials at all in env
    });
    aws.ddb.set(awsDynamoClient);
  }
}
