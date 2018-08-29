import convict from 'convict';
import { Provider } from './providers/provider';
import * as winston from "winston";
import deepmerge from 'deepmerge';
import chalk from 'chalk';
import prettyjson from 'prettyjson';
import { Argv } from 'yargs';

export class Config {
    private static initialConfig = {
        verbose: {
            doc: "The verbosity.",
            format: [true, false],
            default: false,
            env: "VERBOSITY"
        },
        env: {
            doc: "The application environment.",
            format: ["production", "development", "test"],
            default: "development",
            env: "NODE_ENV"
        },
        projectPrefix: {
            doc: "A short project name which is used for directories on the SFTP server.",
            default: "",
            env: "PROJECT_PREFIX"
        },
        source: {
            type: {
                doc: "The type of service to back-up.",
                default: "",
                env: "SOURCE_TYPE"
            }
        },
        target: {
            host: {
                doc: "The target host.",
                default: '',
                env: "TARGET_HOST"
            },
            port: {
                doc: "The SFTP port",
                default: '22',
                env: "TARGET_PORT"
            },
            username: {
                doc: "The SFTP username",
                default: '',
                env: "TARGET_USERNAME"
            },
            password: {
                doc: "The SFTP password",
                default: '',
                env: "TARGET_PASSWORD",
                sensitive: true
            },
            maxBackups: {
                weekly: {
                    doc: "Maximum number of backups to keep for weekly backups",
                    default: '4',
                    env: "TARGET_MAX_BACKUPS_WEEKLY"
                },
                daily: {
                    doc: "Maximum number of backups to keep for daily backups",
                    default: '6',
                    env: "TARGET_MAX_BACKUPS_DAILY"
                }
            }
        },
        slack: {
            webhook: {
                doc: "The webhook URL.",
                default: '',
                env: "SLACK_WEBHOOK"
            }
        },
        cron: {
            weeklySchedule: {
                doc: "The time by which to start a weekly backup",
                default: '00 30 2 * * 0',
                env: "CRON_WEEKLY_SCHEDULE"
            },
            dailySchedule: {
                doc: "The time by which to start a daily backup",
                default: '00 30 2 * * 1-6',
                env: "CRON_DAILY_SCHEDULE"
            },
            delay: {
                doc: "The minutes by which to delay each backup execution. A random value between 0 and 120 is picked if empty (the default).",
                default: '',
                env: "CRON_DELAY"
            }
        }
    };
    private static schema = convict(Config.initialConfig);
    private static mandatoryKeys = [
        'projectPrefix',
        'source.type',
        'target.host',
        'target.username',
        'target.port'
    ];

    static get(key: string) {
        return this.schema.get(key);
    }

    static mergeProviderConfig(provider: Provider) {
        const verbose = this.schema.get('verbose');
        this.schema = convict(deepmerge(this.initialConfig, provider.config()));
        this.schema.set('verbose', verbose)
        provider.mandatoryKeys().forEach(k => this.mandatoryKeys.push(k));
        let error = false;
        this.mandatoryKeys.forEach(k => {
            if (this.schema.get(k) === '') {
                winston.error(`Config is missing ${chalk.underline('mandatory')} key %s`, chalk.bold(k));
                error = true;
            }
        });

        if (error) {
            process.exit(1);
        }
    }

    static mergeYargs(argv: Argv) {
        if (argv['v'] !== undefined) {
            this.schema.set('verbose', argv['v']);
        }
    }

    static print() {
        winston.debug('Loaded the config:\n%s', prettyjson.render(JSON.parse(this.schema.toString())));
    }
}