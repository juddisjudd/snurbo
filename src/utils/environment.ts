import { existsSync, readFileSync } from "fs";
import { Logger } from "./logger";

export interface ValidationRule {
  key: string;
  required: boolean;
  defaultValue?: string;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EnvironmentManager {
  private logger: Logger;
  private rules: ValidationRule[] = [
    {
      key: "DISCORD_TOKEN",
      required: true,
      validator: (value: string) => value.length > 50 && value.includes("."),
      errorMessage: "DISCORD_TOKEN must be a valid Discord bot token",
    },
    {
      key: "DISCORD_CLIENT_ID",
      required: true,
      validator: (value: string) => /^\d{17,19}$/.test(value),
      errorMessage:
        "DISCORD_CLIENT_ID must be a valid Discord application ID (17-19 digits)",
    },
    {
      key: "OLLAMA_BASE_URL",
      required: false,
      defaultValue: "http://localhost:11434",
      validator: (value: string) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      errorMessage: "OLLAMA_BASE_URL must be a valid URL",
    },
    {
      key: "LLM",
      required: false,
      defaultValue: "llama3.1:8b",
      validator: (value: string) => value.length > 0 && !value.includes(" "),
      errorMessage: "LLM must be a valid model name without spaces",
    },
    {
      key: "MAX_CONTEXT_MESSAGES",
      required: false,
      defaultValue: "10",
      validator: (value: string) => {
        const num = parseInt(value);
        return !isNaN(num) && num > 0 && num <= 50;
      },
      errorMessage: "MAX_CONTEXT_MESSAGES must be a number between 1 and 50",
    },
    {
      key: "RESPONSE_CHANCE",
      required: false,
      defaultValue: "0.15",
      validator: (value: string) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 && num <= 1;
      },
      errorMessage: "RESPONSE_CHANCE must be a number between 0 and 1",
    },
    {
      key: "MAX_REQUESTS_PER_MINUTE",
      required: false,
      defaultValue: "5",
      validator: (value: string) => {
        const num = parseInt(value);
        return !isNaN(num) && num > 0 && num <= 100;
      },
      errorMessage:
        "MAX_REQUESTS_PER_MINUTE must be a number between 1 and 100",
    },
    {
      key: "LOG_LEVEL",
      required: false,
      defaultValue: "info",
      validator: (value: string) =>
        ["debug", "info", "warn", "error"].includes(value.toLowerCase()),
      errorMessage: "LOG_LEVEL must be one of: debug, info, warn, error",
    },
    {
      key: "LOG_STYLE",
      required: false,
      defaultValue: "clean",
      validator: (value: string) =>
        ["clean", "compact", "detailed", "production"].includes(
          value.toLowerCase()
        ),
      errorMessage:
        "LOG_STYLE must be one of: clean, compact, detailed, production",
    },
  ];

  constructor() {
    this.logger = new Logger({ service: "snurbo", component: "environment" });
  }

  loadFromFile(): void {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    try {
      if (!existsSync(".env")) {
        return;
      }

      const envContent = readFileSync(".env", "utf-8");
      const envVars = envContent
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"))
        .map((line) => {
          const eqIndex = line.indexOf("=");
          if (eqIndex === -1) return null;

          const key = line.slice(0, eqIndex).trim();
          const value = line
            .slice(eqIndex + 1)
            .trim()
            .replace(/^["'](.*)["']$/, "$1");

          return { key, value };
        })
        .filter(Boolean) as Array<{ key: string; value: string }>;

      for (const { key, value } of envVars) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }

      if (process.env.LOG_LEVEL === "debug") {
        this.logger.debug("Loaded environment variables from .env", {
          variablesLoaded: envVars.length,
        });
      }
    } catch (error) {}
  }

  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of this.rules) {
      const value = process.env[rule.key];

      if (rule.required && !value) {
        errors.push(`Missing required environment variable: ${rule.key}`);
        continue;
      }

      if (!value && rule.defaultValue !== undefined) {
        process.env[rule.key] = rule.defaultValue;
        continue;
      }

      if (value && rule.validator && !rule.validator(value)) {
        const errorMsg = rule.errorMessage || `Invalid value for ${rule.key}`;
        errors.push(`${errorMsg}: "${value}"`);
        continue;
      }
    }

    this.performAdditionalChecks(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private performAdditionalChecks(errors: string[], warnings: string[]): void {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv && !["development", "production", "test"].includes(nodeEnv)) {
      warnings.push(
        `NODE_ENV is set to "${nodeEnv}" but should typically be "development", "production", or "test"`
      );
    }

    if (nodeEnv === "production" && process.env.LOG_LEVEL === "debug") {
      warnings.push(
        "Debug logging is enabled in production mode, consider using 'info' or 'warn' log level"
      );
    }

    const token = process.env.DISCORD_TOKEN;
    if (token && (token.includes("your_") || token === "DISCORD_TOKEN")) {
      errors.push(
        "DISCORD_TOKEN appears to be a placeholder value, not a real Discord bot token"
      );
    }

    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    if (ollamaUrl.includes("localhost") || ollamaUrl.includes("127.0.0.1")) {
      warnings.push(
        "Ollama is configured to use localhost - ensure Ollama is running locally"
      );
    }
  }

  initializeAndValidate(): void {
    this.loadFromFile();

    const result = this.validate();

    if (!result.isValid) {
      console.error("\n❌ Environment Validation Failed:");
      result.errors.forEach((error) => {
        console.error(` • ${error}`);
      });
      console.error("\n💡 Fix these issues:");
      console.error(" 1. Create/check your .env file");
      console.error(
        " 2. Get Discord bot token from https://discord.com/developers/applications"
      );
      console.error(" 3. Ensure Ollama is running (ollama serve)");
      console.error();
      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn("⚠️ Configuration warnings:");
      result.warnings.forEach((warning) => {
        console.warn(` • ${warning}`);
      });
      console.warn();
    }
  }

  async validateOllamaConnection(): Promise<boolean> {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    try {
      const response = await fetch(`${baseUrl}/api/version`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  getEnvironmentSummary(): Record<string, any> {
    return {
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV || "undefined",
      platform: process.platform,
      arch: process.arch,
      discordClientId: process.env.DISCORD_CLIENT_ID || "undefined",
      discordTokenSet: !!process.env.DISCORD_TOKEN,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "undefined",
      llmModel: process.env.LLM || "undefined",
      logLevel: process.env.LOG_LEVEL || "undefined",
      logStyle: process.env.LOG_STYLE || "undefined",
    };
  }
}

export const environmentManager = new EnvironmentManager();
