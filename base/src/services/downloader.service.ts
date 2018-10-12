import { SftpService } from "./sftp.service";
import { Config } from "../config";
import * as winston from "winston";
import chalk from "chalk";

export class DownloaderService extends SftpService {
  public async fetchLatest(
    extension: string,
    localPath: string
  ): Promise<void> {
    const remotePath = `${Config.get("source.type")}/${Config.get(
      "projectPrefix"
    )}/latest${extension}`;
    const sftp = await this.connect();
    winston.debug(`Will try to download ${chalk.bold(remotePath)} to ${chalk.bold(localPath)}.`);
    return new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {}, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
