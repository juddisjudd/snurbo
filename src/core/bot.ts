import { Client, GatewayIntentBits, Message, ActivityType } from "discord.js";
import { MessageHandler } from "@/services/discord/messageHandler";
import { AIService } from "@/services/ai/aiService";
import { ConversationManager } from "@/services/conversation/conversationManager";
import { RateLimiter } from "@/utils/rateLimiter";
import { Logger } from "@/utils/logger";
import { config } from "@/config";

export class DiscordAIBot {
  private client: Client;
  private messageHandler: MessageHandler;
  private aiService: AIService;
  private logger: Logger;
  private isReady = false;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.logger = new Logger({ service: "discord-bot" });
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
    this.client.once("ready", () => {
      this.logger.info("Bot logged in successfully", {
        user: this.client.user?.tag,
        guilds: this.client.guilds.cache.size,
      });
      this.isReady = true;
      this.client.user?.setActivity("conversations", {
        type: ActivityType.Listening,
      });
    });

    this.client.on("messageCreate", async (message) => {
      await this.messageHandler.handle(message, this.client.user!);
    });

    this.client.on("error", (error) => {
      this.logger.error("Discord client error", error);
    });

    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      this.logger.info("Shutting down gracefully");
      this.messageHandler.shutdown();
      this.client.destroy();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  async start(): Promise<void> {
    try {
      await this.client.login(config.token);
    } catch (error) {
      this.logger.error("Failed to start bot", error);
      throw error;
    }
  }

  getStats() {
    return {
      isReady: this.isReady,
      uptime: this.client.uptime,
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      ai: this.aiService.getStats(),
      ...this.messageHandler.getStats(),
    };
  }
}
