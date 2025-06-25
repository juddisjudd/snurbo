type PinoLogLevel = 10 | 20 | 30 | 40 | 50 | 60;

export const loggingStyles = {
  clean: {
    colorize: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname,name",
    singleLine: true,
    hideObject: false,
    levelFirst: true,
    customPrettifiers: {
      level: (logLevel: string) => {
        const level = parseInt(logLevel) as PinoLogLevel;
        const levelMap: Record<PinoLogLevel, string> = {
          10: "DEBUG",
          20: "INFO ",
          30: "WARN ",
          40: "ERROR",
          50: "FATAL",
          60: "SILENT",
        };
        return `[${levelMap[level] || logLevel}]`;
      },
    },
    messageFormat: (log: any, messageKey: string) => {
      const service = log.name ? `${log.name}` : "snurbo";
      const component = log.component ? `:${log.component}` : "";
      return `${service}${component} → ${log[messageKey]}`;
    },
  },

  compact: {
    colorize: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname,name",
    singleLine: true,
    hideObject: true,
    levelFirst: false,
    customPrettifiers: {
      level: (logLevel: string) => {
        const level = parseInt(logLevel) as PinoLogLevel;
        const levelMap: Record<PinoLogLevel, string> = {
          10: "DBG",
          20: "INF",
          30: "WRN",
          40: "ERR",
          50: "FTL",
          60: "SIL",
        };
        return levelMap[level] || logLevel;
      },
    },
  },

  detailed: {
    colorize: true,
    translateTime: "yyyy-mm-dd HH:MM:ss",
    ignore: "pid,hostname",
    singleLine: false,
    hideObject: false,
    levelFirst: true,
    customPrettifiers: {
      level: (logLevel: string) => {
        const level = parseInt(logLevel) as PinoLogLevel;
        const levelMap: Record<PinoLogLevel, string> = {
          10: "DEBUG",
          20: "INFO ",
          30: "WARN ",
          40: "ERROR",
          50: "FATAL",
          60: "SILENT",
        };
        return `[${levelMap[level] || logLevel}]`;
      },
    },
  },

  production: {
    colorize: false,
    translateTime: "iso",
    ignore: "pid,hostname",
    singleLine: true,
    hideObject: false,
    levelFirst: true,
  },
};

export function getLoggingStyle() {
  const style = process.env.LOG_STYLE || "clean";
  return (
    loggingStyles[style as keyof typeof loggingStyles] || loggingStyles.clean
  );
}
