import yargs from "yargs";
import { App } from "./app";

yargs
  .usage("Usage: lifebelt <command> [options]")
  .alias("c", "config")
  .nargs("c", 1)
  .describe("c", "Specify a config file")
  .alias("v", "verbose")
  .describe("v", "Verbose output")
  .default("v", false)
  .boolean("v")
  .help("h")
  .alias("h", "help")
  .command(
    ["cron", "$0"],
    "Will run nightly backups",
    args => args,
    App.cron.bind(this)
  )
  .command(
    "backup",
    "Will create a backup immediately",
    args => args,
    App.backup.bind(this)
  )
  .command(
    "test-backup",
    "Will create a test backup without saving it",
    args => args,
    App.testBackup.bind(this)
  )
  .command(
    "clean",
    "Removes stale backups",
    args => args,
    App.clean.bind(this)
  )
  .command(
    "restore",
    "Restores the latest daily dump",
    args => args,
    App.restore.bind(this)
  )
  .command(
    "providers",
    "List all providers",
    args => args,
    App.listProviders.bind(this)
  )
  .demandCommand()
  .example(
    "lifebelt -c config.json backup",
    "Will create a backup according to the config.json config file right away"
  )
  .epilog("Copyright 2018 Neoskop GmbH").argv;
