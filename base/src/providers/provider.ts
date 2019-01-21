import { SystemCheckResult } from "../system.check.result";
import * as shelljs from "shelljs";
import * as winston from "winston";
import chalk from "chalk";
import { statSync } from "fs";
import convict from "convict";
import { DownloaderService } from "../services/downloader.service";

export abstract class Provider {
  abstract config(): Object;
  abstract systemCheck(): SystemCheckResult;
  abstract displayName(): string;
  abstract async testBackup(): Promise<void>;
  protected abstract async performBackup(): Promise<string>;
  protected abstract async performRestore(artifactPath: string): Promise<void>;

  protected async isDatabaseEmpty(): Promise<boolean> {
    return true;
  }

  protected checkRestorePrereqs() {}

  async restore(): Promise<void> {
    this.checkRestorePrereqs();

    if (!(await this.isDatabaseEmpty())) {
      winston.debug("The database is not empty - won't try to restore");
      return;
    }

    const downloader = new DownloaderService();

    await this.performInTempDirectory(async (tempDirectory: string) => {
      const artifactPath = `${tempDirectory}/latest${this.artifactExtension()}`;
      await downloader.fetchLatest(this.artifactExtension(), artifactPath);
      await this.performRestore(artifactPath);
    });
    
    winston.info("Backup successfully restored");
  }

  public async backup(): Promise<string> {
    const startTime = process.hrtime();
    const filePath = await this.performBackup();
    winston.debug(
      `Finished backup in ${(process.hrtime(startTime)[1] / 1000000).toFixed(
        3
      )}ms`
    );
    return filePath;
  }

  protected async performInTempDirectory(callback: (tempDirectory: string) => Promise<void>) {
    const tempDirectory = this.createTempDirectory();
    const oldDir = shelljs.pwd();
    shelljs.cd(tempDirectory);
    await callback(tempDirectory);
    shelljs.cd(oldDir);
    shelljs.rm('-rf', tempDirectory);
  }

  protected createTempDirectory(): string {
    const result: any = shelljs.exec("mktemp -d", { silent: true });

    if (result.code != 0) {
      throw new Error(`Could not create temp directory: ${result.stderr}`);
    }

    const tempDirectory = result.stdout.replace(/\n$/, "");
    winston.debug(`Created temp directory ${chalk.bold(tempDirectory)}`);
    return tempDirectory;
  }

  protected getFileSize(path: string): string {
    const stats = statSync(path);
    const size = stats["size"];
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return (
      (size / Math.pow(1024, i)).toFixed(2) + ["B", "KB", "MB", "GB", "TB"][i]
    );
  }

  mandatoryKeys(): Array<string> {
    return [];
  }

  artifactExtension(): string {
    return ".tar.gz";
  }

  configProperties() {
    return convict(this.config()).getProperties();
  }
}
