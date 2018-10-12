import { Client, ClientErrorExtensions, SFTPWrapper } from "ssh2";
import { Config } from "../config";
import * as winston from "winston";


export abstract class SftpService {
    private connection: Client;

    constructor() {
      this.connection = new Client();
    }

    protected async checkPathExists(
        sftp: SFTPWrapper,
        path
      ): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
          sftp.stat(path, (err: any) => {
              resolve(err === undefined)
          });
        });
      }

    protected disconnect() {
        this.connection.end();
    }

    protected connect(): Promise<SFTPWrapper> {    
        winston.debug(
          [
            "Will connect to an SFTP server with the following credentials:",
            `host: ${Config.get("target.host")}`,
            `username: ${Config.get("target.username")}`,
            `port: ${Config.get("target.port")}`,
            `password: ${"*".repeat(Config.get("target.password").length)}`
          ].join("\n\t")
        );
    
        return new Promise<SFTPWrapper>((resolve, reject) => {
          this.connection
            .on("ready", () => {
              this.connection.sftp((err: Error, sftp: SFTPWrapper) => {
                if (err) {
                  throw err;
                }
    
                resolve(sftp);
              });
            })
            .on("error", (err: Error & ClientErrorExtensions) => {
              reject(err);
            })
            .connect({
              host: Config.get("target.host"),
              username: Config.get("target.username"),
              port: Config.get("target.port"),
              password: Config.get("target.password")
            });
        });
      }
}