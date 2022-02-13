import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { workspaceRootDir } from '../../../../utils/workspace-root-dir';

const chalk = require('chalk');
const stc = require('string-to-color');

export class ServiceLogger {
  private readonly serviceName: string;
  private readonly subName: string | undefined;
  private readonly logFolder: string;

  constructor(service: string, subName?: string) {
    this.serviceName = service;
    this.subName = subName;

    this.logFolder = join(workspaceRootDir, 'infrastructure', 'local', 'logs');
  }

  private get color(): string {
    return stc(this.fullName);
  }

  private get logFilePath() {
    return join(this.logFolder, this.logFileName);
  }

  private get logFileName() {
    return `${this.fullName.split('::').join('.')}.log`.split('/').join('.');
  }

  private get fullName() {
    return this.subName
      ? `${this.serviceName}::${this.subName}`
      : this.serviceName;
  }

  public log(message: string) {
    const lines = String(message)
      .split('\n')
      .filter((line) => line.length > 0);
    lines.forEach((line) => {
      console.log(
        `${chalk.bgHex(this.color).black(`[${this.fullName}]`)} ${line}`
      );

      if (!existsSync(this.logFolder)) {
        console.log(`Creating log folder at: ${this.logFolder}`);
        mkdirSync(this.logFolder);
      }
      writeFileSync(
        this.logFilePath,
        `[${new Date().toISOString()}] ${line}` + '\n',
        { flag: 'a' }
      );
    });
  }

  public makeChildLogger(childName: string) {
    return new ServiceLogger(this.fullName, childName);
  }
}
