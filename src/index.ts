import { DiscordAIBot } from "./core/bot";
import { environmentManager } from "./utils/environment";
import { logger } from "./utils/logger";

console.log("🚀 Starting SNURBO...");

environmentManager.initializeAndValidate();

async function main() {
  try {
    const bot = new DiscordAIBot();
    await bot.start();

    console.log("✅ SNURBO is online and ready!");
    console.log(`🤖 Model: ${process.env.LLM || "llama3.1:8b"}`);
    console.log(`🎯 Response chance: ${process.env.RESPONSE_CHANCE || "15"}%`);
    console.log();

    if (process.env.NODE_ENV === "development") {
      setInterval(async () => {
        try {
          const stats = bot.getStats();
          const healthStatus = await bot.getHealthStatus();

          if (!healthStatus.ai.healthy || !healthStatus.discord.connected) {
            logger.warn("Health check issues detected", {
              discord: healthStatus.discord.connected ? "✅" : "❌",
              ai: healthStatus.ai.healthy ? "✅" : "❌",
            });
          }
        } catch (error) {}
      }, 5 * 60 * 1000);
    }

    if (process.env.NODE_ENV === "production") {
      setInterval(async () => {
        try {
          const healthStatus = await bot.getHealthStatus();

          if (!healthStatus.ai.healthy) {
            logger.warn("⚠️ AI service unhealthy");
          }
          if (!healthStatus.discord.connected) {
            logger.error("❌ Discord connection lost");
          }
        } catch (error) {
          logger.error("Health check failed", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }, 10 * 60 * 1000);
    }
  } catch (error) {
    console.error("❌ Failed to start SNURBO");

    if (error instanceof Error) {
      if (error.message.includes("TOKEN_INVALID")) {
        console.error("  Invalid Discord token - check your .env file");
      } else if (error.message.includes("DISALLOWED_INTENTS")) {
        console.error(
          "  Missing Discord intents - enable Message Content Intent"
        );
      } else {
        console.error(`  ${error.message}`);
      }
    }
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  console.error("💥 Critical error:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(
    "💥 Unhandled error:",
    reason instanceof Error ? reason.message : String(reason)
  );
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\n👋 SNURBO shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 SNURBO shutting down...");
  process.exit(0);
});

main();
