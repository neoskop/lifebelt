import { IncomingWebhook } from "@slack/client";
import chalk from "chalk";
import { CronJob } from "cron";
import { readdir } from "fs";
import { hostname } from "os";
import { resolve } from "path";
import { exit } from "shelljs";
import { format } from "util";
import * as winston from "winston";
import { Argv } from "yargs";
import { Config } from "./config";
import { customFormat } from "./custom_format";
import { Provider } from "./providers/provider";
import { CleanerService } from "./services/cleaner.service";
import { ClusterService } from "./services/cluster.service";
import { UploaderService } from "./services/uploader.service";

export class App {
  private static async loadProvider(providerName: string): Promise<Provider> {
    const clazz = await import(`./providers/${providerName}.provider`);
    const provider: Provider = new clazz.default();
    winston.info(
      `Loaded ${chalk.bold(provider.displayName())} backup provider`
    );
    const result = provider.systemCheck();

    if (!result.success) {
      winston.error("System check failed: %s", result.errorMessage);
      process.exit(1);
    }

    Config.mergeProviderConfig(provider);
    return provider;
  }

  private static setupWinston() {
    winston.configure({
      format: winston.format.combine(winston.format.splat(), customFormat()),
      transports: [
        new winston.transports.Console({
          level: Boolean(Config.get("verbose")) ? "debug" : "info"
        })
      ]
    });
  }

  private static printBanner() {
    const packageJson = require("../package.json");
    const logo = `
    .iL0@###G:,.       .LGL.  ;1i.    ,tCGCf.            .LGL.                       :CG1           
  ,L@@Gf111i,:::,      ,8#0. :8#@;   ;8#8CGL.            .0#8,                       ;##L   ,ffi    
 ,:;1:.      .,::,     ,8#0.         G#@;                .0#8,                       ;##L   ;##C    
,::,           ,;ii    ,8#0.  i11..1t8#@ft1.  .;tffti,   .0#8;1fff1:      ,itfft;.   ;##L :tL##0ttt:
:::.           .G@8:   ,8#0. .0#8,.C0@##00C. 10@0CC0@8t. .0##88G08#@L,  ,f8@GCC8@0;  ;##L 108##@000i
:;;.           .0#@:   ,8#0. .0#8, .,0#@:.. i@#L,..,f##1 .0#@t, .,f##C..C#@i,..:G#8, ;##L  .;@#C... 
10@L.          t##C.   ,8#0. .0#8,  .0#@,   C##0G0000@@C .0#8,    .0#@,,@#@0000G8@@i ;##L   ;@#C    
.L##C:.      .i8#G,    ,8#0. .0#8,  .0#@,   f##f;        .0#@:    ;@#0..0#@1;        ;##L   ;@#C    
 .10@@G1...,,::i1.     ,8#0. .0#8,  .0#@,   ,C#8fiiifGf. .0##0f11f8#8i  i8#Gtii1LGi  ;##L   ,0#@f1t;
   .iL0t:::::,.        ,0@G. .G@0,  .G@0,    .1G@##@@G1. .G@GL8@##8L:    :f0@##@8L;  ;8@f    :C8##@G

                                              ~   v${packageJson.version}   ~
    `;
    console.log(logo);
  }

  static async setup(argv: Argv): Promise<Provider> {
    Config.mergeYargs(argv);
    App.setupWinston();
    App.printBanner();

    if (Config.get("source.type") === "") {
      winston.error(
        `You need to specify a provider by setting environment variable ${chalk.bold(
          "SOURCE_TYPE"
        )} or config field ${chalk.bold("source.type")}`
      );
      exit(1);
    }

    const provider = await App.loadProvider(Config.get("source.type"));
    Config.print();
    return provider;
  }

  static async handleError(message: string, err: Error) {
    winston.error(message, err.message);
    const webhookUrl = Config.get("slack.webhook");

    if (webhookUrl !== "") {
      const webhook = new IncomingWebhook(webhookUrl);
      const slackMessage = {
        fallback: `The backup with provider ${Config.get(
          "source.type"
        )} for project ${Config.get(
          "projectPrefix"
        )} failed on host ${hostname()} with the following error: ${format(
          message,
          err.message
        )}`,
        text: "",
        pretext: "A lifebelt instance reported a critical error",
        color: "danger",
        fields: [
          {
            title: "Message",
            value: format(message, err.message),
            short: false
          },
          {
            title: "Hostname",
            value: hostname(),
            short: true
          },
          {
            title: "Project",
            value: Config.get("projectPrefix"),
            short: true
          },
          {
            title: "Provider",
            value: Config.get("source.type"),
            short: true
          }
        ]
      };

      return new Promise(async resolve => {
        const result = await webhook.send(slackMessage);
        winston.debug(`Sent slack message: ${result}`);
        resolve();
      });
    }

    return Promise.resolve();
  }

  static async backup(argv: Argv) {
    const provider = await App.setup(argv);
    let filePath: string = "";

    try {
      filePath = await provider.backup();
    } catch (err) {
      await App.handleError("Creation of backup failed: %s", err);
      exit(1);
    }

    try {
      const uploader = new UploaderService();
      await uploader.uploadBackup(
        "daily",
        filePath,
        provider.artifactExtension()
      );
    } catch (err) {
      await App.handleError("Upload of backup failed: %s", err);
      exit(1);
    }
  }

  static async testBackup(argv: Argv) {
    const provider = await App.setup(argv);

    try {
      await provider.testBackup();
    } catch (err) {
      await App.handleError("Test backup failed: %s", err);
      exit(1);
    }
  }

  static async clean(argv: Argv) {
    const provider = await App.setup(argv);

    try {
      const cleaner = new CleanerService();
      await cleaner.cleanAll(provider);
    } catch (err) {
      await App.handleError("Cleaning of stale backups failed: %s", err);
      exit(1);
    }
  }

  static async restore(argv: Argv) {
    const provider = await App.setup(argv);

    try {
      await provider.restore();
    } catch (err) {
      await App.handleError("Restoring of backup failed: %s", err);
      exit(1);
    }
  }

  static async scheduleBackupJob(
    interval: string,
    schedule: string,
    delay: number
  ) {
    let job = new CronJob(
      schedule,
      () => {
        setTimeout(async () => {
          if (
            ClusterService.isClusterModeEnabled() &&
            !(await ClusterService.isLeader())
          ) {
            winston.debug(
              `Not performing ${interval} backup, because I'm not the leader.`
            );
            return;
          }

          const provider = await App.loadProvider(Config.get("source.type"));
          const filePath = await provider.backup();
          const uploader = new UploaderService();
          await uploader.uploadBackup(
            interval,
            filePath,
            provider.artifactExtension()
          );
          const cleaner = new CleanerService();

          try {
            const deletedFiles = await cleaner.clean(interval, provider);
            winston.info(
              deletedFiles.length > 0
                ? `Deleted the following files for ${interval} interval:\n${deletedFiles
                    .map(f => `\t- ${chalk.bold(f)}`)
                    .join("\n")}`
                : "Deleted no files"
            );
          } catch (err) {
            winston.warn(`Could not clean stale backups: ${err.message}`);
          }
        }, delay * 60 * 1000);
      },
      undefined,
      true,
      "Europe/Berlin"
    );
    winston.info(
      `Will run ${chalk.bold(interval)} backup next on ${chalk.bold(
        job.nextDates().toString()
      )} (+ ${delay} minutes)`
    );
  }

  static async cron(argv: Argv) {
    await App.setup(argv);
    const delay: number =
      Config.get("cron.delay") === ""
        ? Math.trunc(Math.random() * 120)
        : Config.get("cron.delay");
    App.scheduleBackupJob("weekly", Config.get("cron.weeklySchedule"), delay);
    App.scheduleBackupJob("daily", Config.get("cron.dailySchedule"), delay);
    ClusterService.printStatus();
  }

  static listProviders(args: Argv) {
    App.printBanner();
    App.setupWinston();
    const path = resolve(__dirname, "providers");
    readdir(path, (err, files) => {
      const promises: Array<Promise<Provider>> = files
        .filter(f => !f.startsWith("provider") && !f.endsWith(".map"))
        .map(f => {
          return new Promise((resolve, reject) => {
            import(
              `./providers/${f
                .split(".")
                .slice(0, -1)
                .join(".")}`
            )
              .then(clazz => {
                try {
                  const provider: Provider = new clazz.default();
                  resolve(provider);
                } catch (err) {
                  reject(
                    `Default export not found in provider ${chalk.bold(f)}`
                  );
                }
              })
              .catch(err => {
                reject(`Couldn't import file ${chalk.bold(f)}: ${err}`);
              });
          });
        });

      Promise.all(promises)
        .then(providers => {
          winston.info("Supported providers:");
          providers.forEach(p => {
            const systemCheckResult = p.systemCheck();
            const color = systemCheckResult.success
              ? chalk.green.hex("50BEF0")
              : chalk.red.hex("FA9678");
            winston.info(
              `  - ${color.bold(p.displayName())}${
                systemCheckResult.success
                  ? ""
                  : ` (${systemCheckResult.errorMessage})`
              }`
            );
          });
        })
        .catch(reason => {
          winston.info("Couldn't load provider: %s", reason);
        });
    });
  }
}
