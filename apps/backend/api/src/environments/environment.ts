const IS_PRODUCTION = process.env.IS_PRODUCTION === 'true';
const IS_LOCAL = process.env.LOCAL_DEVELOPMENT_ENVIRONMENT === 'true';

export const environment = {
  production: IS_PRODUCTION,
  localDevelopment: IS_LOCAL,
  passCodeSecretId: process.env.SECRET_PASS_CODE_ARN,
  cdnBucket: process.env.S3_BUCKET_CDN,
};
