import type { BotConfig } from "@/core/types";

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseFloat(value) : defaultValue;
}

export const config: BotConfig = {
  token: getEnvVar("DISCORD_TOKEN"),
  clientId: getEnvVar("DISCORD_CLIENT_ID"),
  ollamaBaseUrl: getEnvVar("OLLAMA_BASE_URL", "http://localhost:11434"),
  model: getEnvVar("LLM", "llama3.1:8b"),
  maxContextMessages: getEnvNumber("MAX_CONTEXT_MESSAGES", 10),
  responseChance: getEnvNumber("RESPONSE_CHANCE", 0.15),
  maxRequestsPerMinute: getEnvNumber("MAX_REQUESTS_PER_MINUTE", 15),
};

export const responseConfig = {
  temperature: 0.7,
  maxTokens: 100,
  codeMaxTokens: 250,
};
