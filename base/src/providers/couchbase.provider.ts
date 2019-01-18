import { Provider } from "./provider";
import { SystemCheckResult } from "../system.check.result";
import * as shelljs from "shelljs";
import chalk from "chalk";
import { Config } from "../config";
import * as request from "request";
import * as winston from "winston";

class CouchbaseProvider extends Provider {
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
          default: "8091",
          env: "SOURCE_PORT"
        },
        buckets: {
          doc:
            "The names of the buckets to backup separated by comma. Leaving it empty backs up all buckets.",
          default: "",
          env: "SOURCE_BUCKETS"
        },
        username: {
          doc: "The username to connect with.",
          default: "Administrator",
          env: "SOURCE_USERNAME"
        },
        password: {
          doc: "The password to connect with.",
          default: "",
          env: "SOURCE_PASSWORD",
          sensitive: true
        }
      }
    };
  }

  displayName(): string {
    return "Couchbase";
  }

  systemCheck(): SystemCheckResult {
    if (!shelljs.which("cbbackup")) {
      return {
        success: false,
        errorMessage: `Command ${chalk.bold("cbbackup")} not found.`
      };
    }

    return { success: true };
  }

  async performBackup(): Promise<string> {
    const targetDirectory = this.createTempDirectory();
    const commandParts = [
      "cbbackup",
      `http://${Config.get("source.host")}:${Config.get("source.port")}`,
      targetDirectory,
      `-u ${Config.get("source.username")}`,
      `-p ${Config.get("source.password")}`
      // "--single-node" -> Doesn't work in 4.5.1
    ];

    if (Config.get("source.buckets") !== "") {
      Config.get("source.host")
        .split(",")
        .forEach(b => {
          commandParts.push(`-b ${b}`);
        });
    }

    const command = commandParts.join(" ");
    winston.debug(
      `Will execute the following command: ${chalk.bold(
        command.replace(Config.get("source.password"), "*".repeat(Config.get("source.password").length))
      )}`
    );
    const backupResult: any = shelljs.exec(`${command} 2>&1 >/dev/null`, {
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

  async testBackup() {
    await this.waitForServer();
    await this.performBackup();
  }

  async performRestore() {
    throw new Error('Not yet implemented!');
  }

  private serverUri() {
    return `http://${Config.get("source.host")}:${Config.get("source.port")}`;
  }

  private async waitForServer() {
    return new Promise((resolve) => {
      request.head(this.serverUri(), (err, response) => {
        if (err || response.statusCode !== 200) {
          winston.debug("Server not reachable - will retry in 5s");
          setTimeout(() => {
            this.waitForServer().then(() => resolve());
          }, 5000);
        } else {
          resolve();
        }
      });
    });
  }
}

export default CouchbaseProvider;
