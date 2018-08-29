import  * as winston from "winston";
import * as chalk from 'chalk';
import { MESSAGE } from 'triple-beam';
import jsonStringify from 'fast-safe-stringify';

export const customFormat = winston.format((info, opts) => {
    const stringifiedRest = jsonStringify(Object.assign({}, info, {
        level: undefined,
        message: undefined,
        splat: undefined
      }));
    
      let level = info.level.toUpperCase();
      let padding = 0;

      switch (info.level) {
          case 'debug':
            level = chalk.default.blueBright.hex('50BEF0')(level);
            break;
          case 'info':
            level = chalk.default.whiteBright.hex('643C78')(level);
            padding = 1;
            break;
          case 'warn':
            level = chalk.default.yellowBright.hex('FAE664')(level);
            padding = 1;
            break;
          case 'error':
            level = chalk.default.redBright.hex('FA9678')(level);
            break;
      }

      const formattedLevel = `[${chalk.default.bold(level)}]${' '.repeat(padding)}`; 

      if (stringifiedRest !== '{}') {
        info[MESSAGE] = `${formattedLevel} ${info.message} ${stringifiedRest}`;
      } else {
        info[MESSAGE] = `${formattedLevel} ${info.message}`;
      }
    
      return info;
});