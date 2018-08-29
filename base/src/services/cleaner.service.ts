import chalk from "chalk";
import * as winston from "winston";
import { SftpService } from "./sftp.service";
import { Config } from "../config";
import { FileEntry } from "ssh2-streams";
import moment from "moment";
import { Provider } from "../providers/provider";

export class CleanerService extends SftpService {
  private retrieveCreationDate(fileEntry: FileEntry): Date {
    const match: RegExpMatchArray | null = fileEntry.filename.match(
      /-(\d{8})\./
    );

    if (match == null || match.length != 2) {
      throw new Error(`Filename ${fileEntry.filename} does not contain date`);
    }

    return moment(match[1], "YYYYMMDD").toDate();
  }

  async clean(interval: string, provider: Provider): Promise<Array<string>> {
    const sftp = await this.connect();
    const dirPath = `${Config.get("source.type")}/${Config.get(
      "projectPrefix"
    )}/${interval}`;

    if (!(await this.checkPathExists(sftp, dirPath))) {
      winston.warn(`Directory ${chalk.bold(dirPath)} does not exist.`);
      return [];
    }

    const files: Array<FileEntry> = await new Promise<Array<FileEntry>>(
      (resolve, reject) => {
        winston.debug(`Getting directory listing for ${chalk.bold(dirPath)}`);
        sftp.readdir(dirPath, (err, list: Array<FileEntry>) => {
          if (err) {
            reject(err);
          }

          resolve(list);
        });
      }
    );
    try {
      return Promise.all(
        files
          .filter(f =>
            f.filename.match(
              `${Config.get(
                "projectPrefix"
              )}-\\d{8}${provider.artifactExtension().replace(".", "\\.")}`
            )
          )
          .sort((a, b) => {
            const creationDateA: Date = this.retrieveCreationDate(a);
            const creationDateB: Date = this.retrieveCreationDate(b);
            return creationDateB.getTime() - creationDateA.getTime();
          })
          .slice(Config.get(`target.maxBackups.${interval}`))
          .map(f => {
            winston.debug(`Deleting ${chalk.bold(f.filename)}...`);
            return new Promise<string>((resolve, reject) => {
              sftp.unlink(`${dirPath}/${f.filename}`, err => {
                if (err) {
                  reject(err);
                }

                resolve(f.filename);
              });
            });
          })
      );
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async cleanAll(provider: Provider): Promise<void> {
    const deletedFiles: Array<string> = [];
    (await this.clean("daily", provider)).forEach(f => deletedFiles.push(f));
    (await this.clean("weekly", provider)).forEach(f => deletedFiles.push(f));
    winston.info(
      deletedFiles.length > 0
        ? `Deleted the following files:\n${deletedFiles
            .map(f => `\t- ${chalk.bold(f)}`)
            .join("\n")}`
        : "Deleted no files"
    );
  }
}
