import {UnauthorizedError} from "@bobs-bedtime-stories/backend-api-rest";
import {BobsSecretsManager} from "@bobs-bedtime-stories/backend-utils";
import {environment} from "../environments/environment";

export async function authenticate(event: any) {
  const { 'pass-code': givenPassCode } = event.headers;

  if (!givenPassCode) {
    throw new UnauthorizedError('PassCode is missing');
  }

  const secretsManager = new BobsSecretsManager();
  const expectedPasscode = await secretsManager.getValue(environment.passCodeSecretId);
  if (expectedPasscode !== givenPassCode) {
    throw new UnauthorizedError('PassCode is invalid');
  }
}
