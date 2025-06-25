import { DiscordAIBot } from "./core/bot";
import { loadEnvironment, validateRequiredEnvVars } from "./utils/envLoader";
import { logger } from "./utils/logger";

console.log("Starting Discord AI Bot...");
console.log("Using Bun runtime");

loadEnvironment();

const requiredVars = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];
try {
  validateRequiredEnvVars(requiredVars);
} catch (error) {
  process.exit(1);
}

async function main() {
  try {
    const bot = new DiscordAIBot();
    await bot.start();

    logger.info("Bot is now online and ready to chat", {
      model: process.env.LLM || "llama3.1:8b",
      environment: process.env.NODE_ENV || "development",
    });

    if (process.env.NODE_ENV === "development") {
      setInterval(() => {
        const stats = bot.getStats();
        logger.debug("Development statistics", stats);
      }, 5 * 60 * 1000);
    }
  } catch (error) {
    logger.error("Failed to start bot", error);
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", reason, {
    promise: promise.toString(),
  });
  process.exit(1);
});

main();
