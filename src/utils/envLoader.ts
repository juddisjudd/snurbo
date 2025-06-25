import { existsSync, readFileSync } from "fs";
import { logger } from "./logger";

export function loadEnvironment(): void {
  if (process.env.NODE_ENV === "production") return;

  try {
    if (!existsSync(".env")) return;

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
      if (!process.env[key]) process.env[key] = value;
    }

    logger.info("Loaded environment variables from .env");
  } catch (error) {
    logger.warn("Failed to load .env file", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function validateRequiredEnvVars(requiredVars: string[]): void {
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error("Missing required environment variables", {
      missingVars,
      suggestion:
        "Create a .env file with these variables or set them in your environment",
    });

    console.error("Missing required environment variables:");
    missingVars.forEach((varName) => {
      console.error(`  - ${varName}`);
    });
    console.error(
      "\nCreate a .env file with these variables or set them in your environment."
    );
    console.error("See .env.example for reference.");

    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
}
