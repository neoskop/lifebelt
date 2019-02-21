import chalk from "chalk";
import * as os from "os";
import { Config } from "../config";
import winston = require("winston");
import request = require("request");

export class ClusterService {
  public static isClusterModeEnabled(): boolean {
    return Boolean(Config.get("cluster.enabled"));
  }

  public static printStatus() {
    if (Boolean(Config.get("verbose")) && this.isClusterModeEnabled()) {
      setInterval(async () => {
        if (await this.isLeader()) {
          winston.debug(`I am the leader and will be performing backups...`);
        } else {
          const currentLeader = await this.getCurrentLeader();
          winston.debug(
            `Current leader is ${chalk.bold(
              currentLeader
            )}. I won't be performing backups.`
          );
        }
      }, 2000);
    }
  }

  public static async isLeader(): Promise<boolean> {
    try {
      const currentLeader = await this.getCurrentLeader();
      return currentLeader === os.hostname();
    } catch (error) {
      winston.error(`Could not reach leader URL: ${error}`);
      return false;
    }
  }

  private static async getCurrentLeader(): Promise<string> {
    return new Promise((resolve, reject) => {
      request.get(
        Config.get("cluster.leaderUrl"),
        (error: Error, response: request.Response) => {
          if (error) {
            reject(error);
          } else if (response.statusCode !== 200) {
            reject(`Got status code other than 200: ${response.statusCode}`);
          } else {
            const leaderName = JSON.parse(response.body).name;
            resolve(leaderName);
          }
        }
      );
    });
  }
}
