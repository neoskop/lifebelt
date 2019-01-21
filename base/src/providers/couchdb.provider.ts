import chalk from "chalk";
import * as shelljs from "shelljs";
import * as winston from "winston";
import * as fs from "fs";
import { SystemCheckResult } from "../system.check.result";
import { Provider } from "./provider";
import { Config } from "../config";

class CouchDBProvider extends Provider {
  constructor() {
    super();
  }

  config(): Object {
    return {
      source: {
        host: {
          doc: "The hostname to connect to.",
          default: "localhost",
          env: "SOURCE_HOST"
        },
        port: {
          doc: "The port to connect to.",
          default: "5984",
          env: "SOURCE_PORT"
        },
        dataDir: {
          doc: "The directory where the CouchDB data is stored",
          default: "/opt/couchdb/data",
          env: "DATA_DIR"
        }
      }
    };
  }

  displayName(): string {
    return "CouchDB";
  }

  systemCheck(): SystemCheckResult {
    // TODO: Check DATA_DIR is readable
    return { success: true };
  }

  async performBackup(): Promise<string> {
    const targetDirectory = this.createTempDirectory();
    const command = `cp -ar ${Config.get("source.dataDir")} ${targetDirectory}`;
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

  async testBackup(): Promise<void> {}

  async performRestore(artifactPath: string) {
    const unpackingResult: any = shelljs.exec(
      `tar --strip-components 2 -xf ${artifactPath} -C ${Config.get(
        "source.dataDir"
      )}`,
      { silent: true }
    );

    if (unpackingResult.code !== 0) {
      throw new Error(
        `Decompression of backup failed: ${unpackingResult.stderr}`
      );
    }
  }

  protected async isDatabaseEmpty(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      fs.readdir(Config.get("source.dataDir"), function(err, files) {
        if (err) {
          reject(err);
        } else {
          resolve(!files.length);
        }
      });
    });
  }
}

export default CouchDBProvider;
