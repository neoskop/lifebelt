import { Provider } from "./provider";
import { SystemCheckResult } from "../system.check.result";
import * as shelljs from "shelljs";
import chalk from "chalk";
import * as winston from "winston";

class CouchDBProvider extends Provider {
  constructor() {
    super();
  }

  config(): Object {
    return {};
  }

  displayName(): string {
    return "CouchDB";
  }

  systemCheck(): SystemCheckResult {
    return { success: true };
  }

  async performBackup(): Promise<string> {
    const targetDirectory = this.createTempDirectory();
    const command = `cp -ar /opt/couchdb/data ${targetDirectory}`;
    const backupResult: any = shelljs.exec(`${command} >/dev/null`, {
      silent: true
    });

    if (backupResult.code !== 0) {
      throw new Error(`Backup failed: ${backupResult.stderr}`);
    }

    const targetFilename = `/tmp/${new Date().getTime()}.tar.gz`;
    const compressionResult: any = shelljs.exec(
      `tar -zcf ${targetFilename} -C ${targetDirectory} .`,
      { silent: true }
    );

    if (compressionResult.code !== 0) {
      throw new Error(
        `Compressing of backup failed: ${compressionResult.stderr}`
      );
    }

    shelljs.exec(`rm -rf ${targetDirectory}`);
    winston.info(
      `Backup with ${chalk.bold(
        this.getFileSize(targetFilename)
      )} created successfully`
    );
    return targetFilename;
  }

  testBackup() {}

  restore() {}
}

export default CouchDBProvider;
