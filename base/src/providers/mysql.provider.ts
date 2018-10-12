import { Provider } from "./provider";
import { SystemCheckResult } from "../system.check.result";
import * as shelljs from "shelljs";
import chalk from "chalk";
import { Config } from "../config";
import * as winston from "winston";

class MySQLProvider extends Provider {
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
          default: "3306",
          env: "SOURCE_PORT"
        },
        databases: {
          doc:
            "The names of the databases to backup separated by space. Leaving it empty backs up all databases.",
          default: "",
          env: "SOURCE_DATABASES"
        },
        username: {
          doc: "The username to connect with.",
          default: "root",
          env: "SOURCE_USERNAME"
        },
        password: {
          doc: "The password to connect with.",
          default: "",
          env: "SOURCE_PASSWORD",
          sensitive: true
        },
        datadir: {
          doc: "The directory where the MySQL files are located.",
          default: "/var/lib/mysql",
          env: "SOURCE_DATADIR"
        },
        throttle: {
          doc: "The amount of read/write operations per second.",
          default: "50",
          env: "SOURCE_THROTTLE"
        }
      }
    };
  }

  displayName(): string {
    return "MySQL";
  }

  systemCheck(): SystemCheckResult {
    let missingCommands: Array<string> = [];
    ["xtrabackup", "mysqladmin"].forEach(c => {
      if (!shelljs.which(c)) {
        missingCommands.push(c);
      }
    });

    if (missingCommands.length > 0) {
      return {
        success: false,
        errorMessage: `Command(s) ${missingCommands.map(c => chalk.bold(c)).join(', ')} not found.`
      };
    }

    return { success: true };
  }

  async performBackup(): Promise<string> {
    if (!shelljs.test("-e", Config.get("source.datadir"))) {
      throw new Error(
        `Data directory ${chalk.bold(
          Config.get("source.datadir")
        )} does not exist!`
      );
    }

    const targetFilename = `/tmp/${new Date().getTime()}.xbstream`;
    const commandParts = [
      "xtrabackup",
      "--backup",
      "--compress",
      "--stream=xbstream",
      `--throttle=${Config.get("source.throttle")}`,
      `--datadir="${Config.get("source.datadir")}"`,
      `--host="${Config.get("source.host")}"`,
      `--port="${Config.get("source.port")}"`,
      `--user="${Config.get("source.username")}"`
    ];

    if (Config.get("source.password") !== "") {
      commandParts.push(`--password="${Config.get("source.password")}"`);
    }

    if (Config.get("source.databases") !== "") {
      commandParts.push(`--databases="${Config.get("source.databases")}"`);
    }

    commandParts.push(`> ${targetFilename}`);
    const command = commandParts.join(" ");
    winston.debug(
      `Will execute the following command: ${chalk.bold(
        command.replace(Config.get("source.password"), "*".repeat(Config.get("source.password").length))
      )}`
    );

    const backupResult: any = shelljs.exec(command, {
      silent: true
    });

    if (backupResult.code !== 0) {
      throw new Error(`Backup failed: ${backupResult.stderr}`);
    }

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

  async performRestore() {}

  artifactExtension() {
    return ".xbstream";
  }

  private async waitForServer() {
    return new Promise((resolve) => {
      shelljs.exec(`mysqladmin ping -h${Config.get("source.host")} --silent`, (code) => {
        if (code !== 0) {
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

export default MySQLProvider;
