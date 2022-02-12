import {config} from 'dotenv';

config();

const IS_PRODUCTION = process.env.IS_PRODUCTION === 'true';
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';

export const environment = {
  production: IS_PRODUCTION,
  offline: IS_OFFLINE,
  passCode: process.env.PASS_CODE as string,
};
