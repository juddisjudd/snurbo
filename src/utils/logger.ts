import {
  configure,
  getLogger,
  getConsoleSink,
  type Logger as LogTapeLogger,
  type LogLevel,
} from "@logtape/logtape";

interface LoggerConfig {
  level?: LogLevel;
  service?: string;
  component?: string;
}

function normalizeError(error: unknown): Error | object | string {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") return error;
  return String(error);
}

export class Logger {
  private logger: LogTapeLogger;
  private category: string[];

  constructor(config: LoggerConfig = {}) {
    const { level = "info", service = "snurbo", component } = config;

    this.category = component ? [service, component] : [service];

    this.configureLogging(level);

    this.logger = getLogger(this.category);
  }

  private configureLogging(level: LogLevel): void {
    if (!Logger.isConfigured) {
      const isDevelopment = process.env.NODE_ENV !== "production";

      configure({
        sinks: {
          console: getConsoleSink(),
        },
        loggers: [
          {
            category: ["snurbo"],
            lowestLevel: level,
            sinks: ["console"],
          },
        ],
      });

      Logger.isConfigured = true;
    }
  }

  private static isConfigured = false;

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta || {});
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta || {});
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta || {});
  }

  error(
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>
  ): void {
    const normalizedError = error ? normalizeError(error) : undefined;

    let errorMeta: Record<string, unknown> = {};

    if (normalizedError instanceof Error) {
      errorMeta = {
        error: {
          message: normalizedError.message,
          stack: normalizedError.stack,
          name: normalizedError.name,
        },
      };
    } else if (normalizedError && typeof normalizedError === "object") {
      errorMeta = { error: normalizedError };
    } else if (normalizedError) {
      errorMeta = { error: normalizedError };
    }

    const finalMeta = { ...errorMeta, ...(meta || {}) };

    this.logger.error(message, finalMeta);
  }

  child(bindings: { component?: string; service?: string }): Logger {
    const newCategory = [...this.category];

    if (bindings.component) {
      newCategory.push(bindings.component);
    }

    return new Logger({
      service: newCategory[0],
      component: newCategory.slice(1).join(":"),
    });
  }

  static create(config?: LoggerConfig): Logger {
    return new Logger(config);
  }
}

export const logger = Logger.create({
  level: (process.env.LOG_LEVEL as LogLevel) || "info",
  service: "snurbo",
});
