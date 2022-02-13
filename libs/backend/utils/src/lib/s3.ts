import { S3 } from 'aws-sdk';

export class BobsS3 {
  private readonly s3: S3;

  constructor(params?: S3.ClientConfiguration) {
    const isLocal = process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true';

    this.s3 = new S3({
      endpoint: isLocal ? 'http://localhost:9000' : undefined,
      ...(params ?? {}),
      region: isLocal ? 'us-east-1' : params?.region,
      s3ForcePathStyle: isLocal ? true : params?.s3ForcePathStyle,
      signatureVersion: isLocal ? 'v4' : params?.signatureVersion,
      maxRetries: 30,
    });
  }

  public async upload(
    params: S3.PutObjectRequest
  ): Promise<S3.ManagedUpload.SendData> {
    return this.s3.upload(params).promise();
  }

  public async getObject(
    params: S3.GetObjectRequest
  ): Promise<S3.GetObjectOutput> {
    return this.s3.getObject(params).promise();
  }

  public createPreSignedPost(
    params: S3.PresignedPost.Params
  ): S3.PresignedPost {
    return this.s3.createPresignedPost(params);
  }
}
