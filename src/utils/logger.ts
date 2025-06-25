import pino from "pino";

interface LoggerConfig {
  level?: "debug" | "info" | "warn" | "error";
  pretty?: boolean;
  service?: string;
}

function normalizeError(error: unknown): Error | object | string {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") return error;
  return String(error);
}

export class Logger {
  private logger: pino.Logger;

  constructor(config: LoggerConfig = {}) {
    const {
      level = "info",
      pretty = process.env.NODE_ENV !== "production",
      service = "discord-bot",
    } = config;

    if (pretty) {
      this.logger = pino({
        level,
        name: service,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
            singleLine: true,
            levelFirst: true,
          },
        },
      });
    } else {
      this.logger = pino({
        level,
        name: service,
      });
    }
  }

  debug(message: string, meta?: object): void {
    this.logger.debug(meta || {}, message);
  }

  info(message: string, meta?: object): void {
    this.logger.info(meta || {}, message);
  }

  warn(message: string, meta?: object): void {
    this.logger.warn(meta || {}, message);
  }

  error(message: string, error?: unknown, meta?: object): void {
    const normalizedError = error ? normalizeError(error) : undefined;
    const errorMeta =
      normalizedError instanceof Error
        ? {
            error: {
              message: normalizedError.message,
              stack: normalizedError.stack,
              name: normalizedError.name,
            },
          }
        : normalizedError && typeof normalizedError === "object"
        ? { error: normalizedError }
        : normalizedError
        ? { error: normalizedError }
        : {};

    this.logger.error({ ...errorMeta, ...meta }, message);
  }

  child(bindings: object): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  static create(config?: LoggerConfig): Logger {
    return new Logger(config);
  }
}

export const logger = Logger.create({
  level: (process.env.LOG_LEVEL as any) || "info",
  service: "snurbo-bot",
});
