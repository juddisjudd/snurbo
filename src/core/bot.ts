import {
  Client,
  GatewayIntentBits,
  Message,
  ActivityType,
  MessageFlags,
} from "discord.js";
import { MessageHandler } from "@/services/discord/messageHandler";
import { AIService } from "@/services/ai/aiService";
import { ConversationManager } from "@/services/conversation/conversationManager";
import { RateLimiter } from "@/utils/rateLimiter";
import { Logger } from "@/utils/logger";
import { environmentManager } from "@/utils/environment";
import { config } from "@/config";

export class DiscordAIBot {
  private client: Client;
  private messageHandler: MessageHandler;
  private aiService: AIService;
  private logger: Logger;
  private isReady = false;
  private startTime = Date.now();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.logger = new Logger({ service: "snurbo", component: "discord-bot" });

    this.aiService = new AIService();
    const conversationManager = new ConversationManager();
    const rateLimiter = new RateLimiter();

    this.messageHandler = new MessageHandler(
      this.aiService,
      conversationManager,
      rateLimiter,
      this.logger.child({ component: "message-handler" })
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once("ready", async () => {
      this.isReady = true;

      try {
        this.client.user?.setActivity("conversations", {
          type: ActivityType.Listening,
        });
      } catch (error) {}

      await this.performStartupChecks();
    });

    this.client.on("messageCreate", async (message) => {
      if (!this.isReady) return;

      try {
        await this.messageHandler.handle(message, this.client.user!);
      } catch (error) {
        this.logger.error("Message handler error", {
          messageId: message.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    this.client.on("error", (error) => {
      this.logger.error("Discord client error", {
        name: error.name,
        error: error.message,
      });
    });

    this.client.on("shardError", (error, shardId) => {
      this.logger.error("Discord shard error", {
        shardId,
        error: error.message,
      });
    });

    this.setupGracefulShutdown();
  }

  private async performStartupChecks(): Promise<void> {
    try {
      const ollamaHealthy = await environmentManager.validateOllamaConnection();
      const aiHealthy = await this.aiService.healthCheck();

      if (!ollamaHealthy) {
        this.logger.warn(
          "Ollama service not accessible - AI responses may fail"
        );
      }
      if (!aiHealthy) {
        this.logger.warn("AI service health check failed");
      }
    } catch (error) {}
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        this.isReady = false;

        this.messageHandler.shutdown();

        this.client.destroy();

        this.logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during shutdown", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught Exception - shutting down", {
        error: error.message,
        stack: error.stack,
      });
      shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error("Unhandled Rejection - shutting down", {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: promise.toString(),
      });
      shutdown("unhandledRejection");
    });
  }

  async start(): Promise<void> {
    try {
      await this.client.login(config.token);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("TOKEN_INVALID")) {
          throw new Error("Invalid Discord token - check your .env file");
        } else if (error.message.includes("DISALLOWED_INTENTS")) {
          throw new Error(
            "Missing Discord intents - enable Message Content Intent"
          );
        } else if (error.message.includes("insufficient permission")) {
          throw new Error("Bot missing permissions in Discord servers");
        }
      }
      throw error;
    }
  }

  getStats() {
    const uptime = this.client.uptime || 0;
    const messageHandlerStats = this.messageHandler.getStats();

    return {
      isReady: this.isReady,
      uptime,
      uptimeFormatted: this.formatUptime(uptime),
      startTime: new Date(this.startTime).toISOString(),
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      channels: this.client.channels.cache.size,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      ...messageHandlerStats,
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async refreshAIModel(): Promise<string> {
    try {
      return await this.aiService.refreshModel();
    } catch (error) {
      this.logger.error("Failed to refresh AI model", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async getHealthStatus() {
    const aiStats = this.aiService.getStats();
    const isOllamaHealthy = await this.aiService.healthCheck();

    return {
      discord: {
        connected: this.client.isReady(),
        uptime: this.client.uptime,
        guilds: this.client.guilds.cache.size,
        latency: this.client.ws.ping,
      },
      ai: {
        healthy: isOllamaHealthy,
        model: aiStats.model,
        baseUrl: aiStats.baseUrl,
        lastHealthCheck: aiStats.lastHealthCheck,
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
      },
    };
  }
}
