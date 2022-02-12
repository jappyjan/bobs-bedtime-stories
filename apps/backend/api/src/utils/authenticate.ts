import {environment} from "../environments/environment";

export function authenticate(event: any) {
  const {'pass-code': passCode} = event.headers;

  if (!passCode) {
    throw new Error('PassCode is missing');
  }

  if (environment.passCode !== passCode) {
    throw new Error('PassCode is invalid');
  }
}
