import { readFileSync, existsSync } from "fs";

console.log("Discord AI Bot Setup");
console.log("====================\n");

if (!existsSync(".env")) {
  console.log("No .env file found. Please create one:");
  console.log("  cp .env.example .env");
  console.log("  # Then edit .env with your Discord bot token\n");
}

const requiredVars = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];
let envOk = true;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.log(`Missing: ${varName}`);
    envOk = false;
  } else {
    console.log(`Found: ${varName}`);
  }
}

if (!envOk) {
  console.log("\nTo get Discord bot credentials:");
  console.log("1. Go to https://discord.com/developers/applications");
  console.log("2. Create a new application");
  console.log('3. Go to "Bot" section and create a bot');
  console.log("4. Copy the token to DISCORD_TOKEN in .env");
  console.log("5. Copy the Application ID to DISCORD_CLIENT_ID in .env");
  console.log("\nNeed more help? Check the Discord.js guide:");
  console.log(
    "  https://discordjs.guide/preparations/setting-up-a-bot-application.html\n"
  );
}

console.log("Checking Ollama connection...");

async function checkOllama() {
  try {
    const response = await fetch("http://localhost:11434/api/version");
    if (response.ok) {
      console.log("Ollama is running");

      try {
        const modelsResponse = await fetch("http://localhost:11434/api/tags");
        const models = await modelsResponse.json();
        const allModels = models.models || [];

        if (allModels.length > 0) {
          console.log("Available models:");
          allModels.forEach((model: any) => {
            const isCurrentModel =
              model.name === (process.env.LLM || "llama3.1:8b");
            const indicator = isCurrentModel ? " <- (current)" : "";
            console.log(
              `  - ${model.name} (${(model.size / 1e9).toFixed(
                1
              )}GB)${indicator}`
            );
          });
        } else {
          console.log("No models found. Recommended models:");
          console.log(
            "  ollama run llama3.1:8b # Well-rounded, good instruction following"
          );
          console.log("  ollama run gemma3:4b # Fast, good for chat");
          console.log("  ollama run qwen2.5:7b # Another solid option");
        }
      } catch (error) {
        console.log("Could not check available models");
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.log("Ollama not accessible");
    console.log("To install Ollama:");
    console.log("1. Download from: https://ollama.com/download/windows");
    console.log("2. Install and restart your terminal");
    console.log("3. Run: ollama run llama3.1:8b");
    console.log("4. Wait for model download (can be several GB)");
  }
}

await checkOllama();

console.log("\nChecking dependencies...");
try {
  const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
  const deps = Object.keys(packageJson.dependencies || {});
  console.log(`Dependencies: ${deps.join(", ")}`);
} catch (error) {
  console.log("Could not read package.json");
}

console.log("\nReady to start?");
console.log("1. Make sure your .env file is configured");
console.log("2. Make sure Ollama is running with your chosen model");
console.log("3. Run: bun run dev");
console.log("\nThe bot will respond naturally to:");
console.log("  - Direct messages");
console.log("  - @mentions in servers");
console.log("  - Random messages in channels (15% chance by default)");
console.log("\nAdjust behavior in src/config/index.ts");
console.log("Monitor logs for activity and rate limiting");
console.log(
  "\nCurrent model from .env:",
  process.env.LLM || "llama3.1:8b (default)"
);
console.log("\nHappy chatting!");
