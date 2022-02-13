import { SecretsManager } from 'aws-sdk';

export class BobsSecretsManager {
  private secretsManager: SecretsManager;

  constructor() {
    const isLocal = process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true';

    this.secretsManager = new SecretsManager({
      endpoint: isLocal ? 'http://localhost:3000' : undefined,
      maxRetries: 30,
    });
  }

  public async getValue(secretId: string) {
    const response = await this.secretsManager
      .getSecretValue({
        SecretId: secretId,
      })
      .promise();

    let secret: string;
    if ('SecretString' in response) {
      secret = response.SecretString as string;
    } else {
      const buff = new Buffer(response.SecretBinary as string, 'base64');
      secret = buff.toString('ascii');
    }

    return secret;
  }
}
