import { Provider } from "./provider";
import { SystemCheckResult } from "../system.check.result";
import * as shelljs from "shelljs";
import chalk from "chalk";
import { Config } from "../config";
import * as winston from "winston";
import * as fs from "fs";
import * as path from "path";

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
        errorMessage: `Command(s) ${missingCommands
          .map(c => chalk.bold(c))
          .join(", ")} not found.`
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
        command.replace(
          Config.get("source.password"),
          "*".repeat(Config.get("source.password").length)
        )
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

  async testBackup(): Promise<void> {
    await this.waitForServer();
    await this.performBackup();
  }

  private async getFiles(dir: string): Promise<string[]> {
    const subdirs = fs.readdirSync(dir);
    const files = await Promise.all(
      subdirs.map(async subdir => {
        const res = path.resolve(dir, subdir);
        return fs.statSync(res).isDirectory() ? this.getFiles(res) : [res];
      })
    );
    return files.reduce((a, f) => a.concat(f), []);
  }

  private prepareBackup(runCount: number) {
    const prepareResult: any = shelljs.exec(
      "xtrabackup --prepare --target-dir=.",
      {
        silent: true
      }
    );

    if (prepareResult.code !== 0) {
      throw new Error(`Preparing of backup failed: ${prepareResult.stderr}`);
    }

    winston.debug(`Prepare run #${runCount} succeeded.`);
  }

  protected checkRestorePrereqs() {
    if (process.getuid() !== 0) {
      throw new Error("Lifebelt must run as root when restoring MySQL data");
    }
  }

  async performRestore(artifactPath: string) {
    await this.performInTempDirectory(async () => {
      const unpackingResult: any = shelljs.exec(
        `xbstream -x < ${artifactPath}`,
        {
          silent: true
        }
      );

      if (unpackingResult.code !== 0) {
        throw new Error(
          `Unpacking of backup failed: ${unpackingResult.stderr}`
        );
      }

      winston.debug(`Unpacked ${chalk.bold(artifactPath)} successfully`);

      const qpressFiles = (await this.getFiles(".")).filter(f =>
        f.endsWith(".qp")
      );
      qpressFiles.forEach(f => {
        const decompressionResult: any = shelljs.exec(
          `qpress -vd ${f} $(dirname ${f})`,
          {
            silent: true
          }
        );

        if (decompressionResult.code !== 0) {
          throw new Error(
            `Decompression of qpress file ${chalk.bold(f)} failed: ${
              decompressionResult.stderr
            }`
          );
        }
      });
      qpressFiles.forEach(f => shelljs.rm(f));

      winston.debug(`Decompressed qpress files successfully`);

      this.prepareBackup(1);
      this.prepareBackup(2);

      const copyResult: any = shelljs.exec("rsync -avrP . /var/lib/mysql", {
        silent: true
      });

      if (copyResult.code !== 0) {
        throw new Error(`Copying of files failed: ${copyResult.stderr}`);
      }

      const chownResult: any = shelljs.exec(
        "chown -R mysql:mysql /var/lib/mysql",
        {
          silent: true
        }
      );

      if (chownResult.code !== 0) {
        throw new Error(
          `Changing ownership of files failed: ${chownResult.stderr}`
        );
      }
    });
  }

  artifactExtension() {
    return ".xbstream";
  }

  private async waitForServer() {
    return new Promise(resolve => {
      shelljs.exec(
        `mysqladmin ping -h${Config.get("source.host")} --silent`,
        code => {
          if (code !== 0) {
            winston.debug("Server not reachable - will retry in 5s");
            setTimeout(() => {
              this.waitForServer().then(() => resolve());
            }, 5000);
          } else {
            resolve();
          }
        }
      );
    });
  }

  protected async isDatabaseEmpty(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const datadir = Config.get("source.datadir");
      winston.debug(`Check that ${chalk.bold(datadir)} exists`);

      if (!fs.existsSync(datadir)) {
        winston.debug(`Data directory ${chalk.bold(datadir)} does not exist`);
        resolve(false);
        return;
      } else {
        winston.debug(`Check that ${chalk.bold(datadir)} is accessible`);

        try {
          fs.accessSync(datadir, fs.constants.R_OK | fs.constants.X_OK);
        } catch (err) {
          winston.debug(`Can't read/execute ${chalk.bold(datadir)}`);
          resolve(false);
          return;
        }

        winston.debug(`Check that ${chalk.bold(datadir)} is not empty`);
        fs.readdir(datadir, function(err, files) {
          if (err) {
            reject(err);
          } else {
            if (files.length) {
              winston.debug(
                `${chalk.bold(
                  datadir
                )} contains the following files: ${files.join(", ")}`
              );
            }
            resolve(!files.length);
          }
        });
      }
    });
  }
}

export default MySQLProvider;
