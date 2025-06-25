import { Message, ChannelType, User } from "discord.js";
import { AIService } from "@/services/ai/aiService";
import { ConversationManager } from "@/services/conversation/conversationManager";
import { MessageAnalyzer } from "@/services/conversation/messageAnalyzer";
import { RateLimiter } from "@/utils/rateLimiter";
import { Logger } from "@/utils/logger";
import { config } from "@/config";

export class MessageHandler {
  private channelActivity = new Map<string, number[]>();
  private messageAnalyzer: MessageAnalyzer;
  private logger: Logger;

  constructor(
    private aiService: AIService,
    private conversationManager: ConversationManager,
    private rateLimiter: RateLimiter,
    logger?: Logger
  ) {
    this.messageAnalyzer = new MessageAnalyzer();
    this.logger = logger || new Logger({ service: "message-handler" });
    this.startMaintenanceTasks();
  }

  async handle(message: Message, botUser: User): Promise<void> {
    if (message.author.bot) return;

    this.trackChannelActivity(message.channelId);

    try {
      const shouldProcess = await this.shouldProcessMessage(message, botUser);
      if (!shouldProcess.should) return;

      const analysis = this.messageAnalyzer.analyzeMessage(message.content);

      this.logger.info("Processing message", {
        user: message.author.tag,
        reason: shouldProcess.reason,
        messageLength: message.content.length,
        requiresCode: analysis.requiresCode,
      });

      if (!this.checkRateLimits(message)) return;

      if ("sendTyping" in message.channel) {
        await message.channel.sendTyping();
      }

      const context = await this.conversationManager.getContext(
        message.author.id,
        message.channelId
      );

      if (!context.userProfile.name && message.member?.displayName) {
        context.userProfile.name = message.member.displayName;
      }

      const response = await this.aiService.generateResponse(
        message.content,
        context,
        analysis.requiresCode
      );

      const delay = this.conversationManager.getResponseDelay(
        message.content.length
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      await message.reply(response);

      await this.conversationManager.updateContext(
        message.author.id,
        message.channelId,
        message.content,
        response
      );

      this.logger.info("Successfully responded to message", {
        user: message.author.tag,
        responseLength: response.length,
      });
    } catch (error) {
      this.logger.error("Error handling message", error, {
        user: message.author.tag,
        messageId: message.id,
        channelId: message.channelId,
      });

      if (Math.random() < 0.3) {
        try {
          await message.reply("having some issues right now, try again?");
        } catch (replyError) {
          this.logger.error("Error sending error message", replyError);
        }
      }
    }
  }

  private async shouldProcessMessage(
    message: Message,
    botUser: User
  ): Promise<{ should: boolean; reason?: string }> {
    const isMentioned = message.mentions.has(botUser);
    const isNameMentioned = message.content.toLowerCase().includes("snurbo");
    const isDM = message.channel.type === ChannelType.DM;

    if (isDM) return { should: true, reason: "DM" };
    if (isMentioned) return { should: true, reason: "@mention" };
    if (isNameMentioned) return { should: true, reason: "name mention" };

    const analysis = this.messageAnalyzer.analyzeMessage(message.content);
    const activity = this.getChannelActivity(message.channelId);

    if (analysis.isQuestion && analysis.confidence > 0.6 && activity < 5) {
      return { should: true, reason: "question detected" };
    }

    const shouldRespond = this.conversationManager.shouldRespond(
      message.content,
      false,
      false,
      activity
    );

    return {
      should: shouldRespond,
      reason: shouldRespond ? "random response" : undefined,
    };
  }

  private checkRateLimits(message: Message): boolean {
    if (
      !this.rateLimiter.checkUserLimit(
        message.author.id,
        config.maxRequestsPerMinute
      )
    ) {
      this.logger.warn("Rate limit hit for user", { user: message.author.tag });
      return false;
    }

    if (!this.rateLimiter.checkChannelLimit(message.channelId)) {
      this.logger.warn("Rate limit hit for channel", {
        channelId: message.channelId,
      });
      return false;
    }

    return true;
  }

  private trackChannelActivity(channelId: string): void {
    const now = Date.now();
    const activity = this.channelActivity.get(channelId) || [];
    activity.push(now);

    const oneMinuteAgo = now - 60000;
    const recentActivity = activity.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );
    this.channelActivity.set(channelId, recentActivity);
  }

  private getChannelActivity(channelId: string): number {
    return (this.channelActivity.get(channelId) || []).length;
  }

  private startMaintenanceTasks(): void {
    setInterval(() => {
      this.rateLimiter.cleanup();
      this.cleanupChannelActivity();
    }, 5 * 60 * 1000);

    setInterval(() => {
      const stats = this.conversationManager.getStats();
      this.logger.info("Bot statistics", {
        activeContexts: stats.activeContexts,
        totalMessages: stats.totalMessages,
        activeChannels: this.channelActivity.size,
      });
    }, 30 * 60 * 1000);
  }

  private cleanupChannelActivity(): void {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;

    for (const [channelId, timestamps] of this.channelActivity.entries()) {
      const recent = timestamps.filter((t) => t > tenMinutesAgo);
      if (recent.length === 0) {
        this.channelActivity.delete(channelId);
      } else {
        this.channelActivity.set(channelId, recent);
      }
    }
  }

  getStats() {
    return {
      conversations: this.conversationManager.getStats(),
      activeChannels: this.channelActivity.size,
    };
  }

  shutdown(): void {
    this.conversationManager.shutdown();
  }
}
