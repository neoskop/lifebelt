import { SFTPWrapper } from "ssh2";
import { createReadStream } from "fs";
import { Config } from "../config";
import moment from "moment";
import chalk from "chalk";
import * as winston from "winston";
import { SftpService } from "./sftp.service";

export class UploaderService extends SftpService {
  private async createDir(sftp: SFTPWrapper, path: string): Promise<any> {
    if (!(await this.checkPathExists(sftp, path))) {
      winston.debug(
        `Creating directory ${chalk.bold(path)} as it doesn't exist yet`
      );
      return new Promise((resolve, reject) => {
        sftp.mkdir(path, err => {
          if (err) {
            reject(`Could not create directory ${path}: ${err}`);
          }

          return resolve();
        });
      });
    }

    return Promise.resolve();
  }

  private async createDirStructure(sftp: SFTPWrapper, path: string) {
    const pathParts = path.split("/");
    let currentPath = "";

    for (const p of pathParts) {
      currentPath += `${p}/`;
      await this.createDir(sftp, currentPath);
    }
  }

  private getRealPath(sftp: SFTPWrapper, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      sftp.realpath(path, (err, absPath: string) => {
        if (err) {
          reject(err);
        }

        resolve(absPath);
      });
    });
  }

  private async updateLatestSymlink(
    sftp: SFTPWrapper,
    sourcePath: string,
    targetDirPath: string,
    targetFileName: string
  ) {
    try {
      const realSourcePath = await this.getRealPath(sftp, sourcePath);
      const realTargetDirPath = await this.getRealPath(sftp, targetDirPath);
      const realTargetPath = `${realTargetDirPath}/${targetFileName}`;
      if (await this.checkPathExists(sftp, realTargetPath)) {
        await new Promise((resolve, reject) => {
          sftp.unlink(realTargetPath, err => {
            if (err) {
              reject(
                `Could not delete existing symlink ${chalk.bold(
                  realTargetPath
                )}`
              );
            }

            winston.debug(
              `Deleted existing symlink ${chalk.bold(realTargetPath)}`
            );
            resolve();
          });
        });
      }
      await new Promise((resolve, reject) => {
        sftp.symlink(realSourcePath, realTargetPath, (err: Error) => {
          if (err) {
            reject(
              `Symlinking ${chalk.bold(realSourcePath)} to ${chalk.bold(
                realTargetPath
              )} failed: ${err.message}`
            );
          }

          resolve();
        });
      });
      winston.debug(
        `Updated symlink ${chalk.bold(realTargetPath)} to ${chalk.bold(
          realSourcePath
        )}`
      );
    } catch (err) {
      winston.warn(`Could not update latest symlink: ${err}`);
    }
  }

  public async uploadBackup(
    interval: string,
    filePath: string,
    extension: string
  ) {
    const providerName = Config.get("source.type");
    const sftp = await this.connect();
    const directory = `${providerName}/${Config.get(
      "projectPrefix"
    )}/${interval}`;
    this.createDirStructure(sftp, directory).then(() => {
      const readStream = createReadStream(filePath);
      const path = `${directory}/${Config.get(
        "projectPrefix"
      )}-${moment().format("YYYYMMDD")}${extension}`;
      const writeStream = sftp.createWriteStream(path);
      return new Promise((resolve, reject) => {
        writeStream.on("close", () => {
          winston.debug(`Successfully uploaded backup to ${chalk.bold(path)}`);
          this.updateLatestSymlink(
            sftp,
            path,
            `${providerName}/${Config.get("projectPrefix")}`,
            `latest${extension}`
          ).then(() => {
            this.disconnect();
            resolve();
          });
        });

        writeStream.on("end", () => {
          this.disconnect();
          reject();
        });

        writeStream.on("error", () => {
          this.disconnect();
          reject("Uploading of the file failed");
        });

        readStream.pipe(writeStream);
      });
    });
  }
}
