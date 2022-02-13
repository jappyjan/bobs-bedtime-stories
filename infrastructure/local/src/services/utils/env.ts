import { ServiceLogger } from './service-logger';

export class Env {
  private _map = new Map<string, string>();

  public set(logger: ServiceLogger, key: string, value: string): this {
    logger.log(`Setting environment variable ${key} to ${value}`);
    process.env[key] = value;
    this._map.set(key, value);
    return this;
  }

  public get(key: string, defaultValue?: string) {
    const envValue = this._map.get(key);

    if (!envValue && defaultValue) {
      return defaultValue;
    }

    if (!envValue) {
      throw new Error(`Environment variable ${key} is not set`);
    }

    return envValue;
  }

  public toObject() {
    return Object.fromEntries(this._map);
  }
}
