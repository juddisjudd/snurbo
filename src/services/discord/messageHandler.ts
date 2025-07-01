import {
  Message,
  ChannelType,
  User,
  MessageFlags,
  TextBasedChannel,
  GuildMember,
  ThreadChannel,
} from "discord.js";
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
    this.logger =
      logger || new Logger({ service: "snurbo", component: "message-handler" });
    this.startMaintenanceTasks();
  }

  async handle(message: Message, botUser: User): Promise<void> {
    if (message.author.bot) return;

    this.trackChannelActivity(message.channelId);

    try {
      const shouldProcess = await this.shouldProcessMessage(message, botUser);
      if (!shouldProcess.should) return;

      const analysis = this.messageAnalyzer.analyzeMessage(message.content);
      const channelInfo = this.getChannelInfo(message);

      this.logger.info("Processing message", {
        user: message.author.tag,
        reason: shouldProcess.reason,
        messageLength: message.content.length,
        requiresCode: analysis.requiresCode,
        channelType: channelInfo.type,
        isThread: channelInfo.isThread,
        threadParent: channelInfo.threadParent,
      });

      if (!this.checkRateLimits(message)) return;

      try {
        if (
          "sendTyping" in message.channel &&
          typeof message.channel.sendTyping === "function"
        ) {
          await message.channel.sendTyping();
        }
      } catch (error) {
        this.logger.warn("Failed to send typing indicator", {
          channelId: message.channelId,
          channelType: channelInfo.type,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      const context = await this.conversationManager.getContext(
        message.author.id,
        message.channelId
      );

      if (!context.userProfile.name && message.member?.displayName) {
        context.userProfile.name = message.member.displayName;
      }

      if (channelInfo.isThread && channelInfo.threadParent) {
        context.threadContext = {
          isThread: true,
          parentChannelId: channelInfo.threadParent,
          threadName: channelInfo.name,
        };
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

      try {
        await message.reply({ content: response });
      } catch (replyError) {
        if (
          replyError instanceof Error &&
          replyError.message.includes("rate limit")
        ) {
          this.logger.warn("Discord API rate limit hit, will retry", {
            messageId: message.id,
            channelId: message.channelId,
          });

          setTimeout(async () => {
            try {
              if (
                "send" in message.channel &&
                typeof message.channel.send === "function"
              ) {
                await message.channel.send(response);
                this.logger.info(
                  "Successfully sent message after rate limit retry"
                );
              }
            } catch (sendError) {
              this.logger.error(
                "Failed to send after rate limit retry",
                sendError
              );
            }
          }, 1000);
          return;
        }

        this.logger.error("Failed to send reply", {
          messageId: message.id,
          channelId: message.channelId,
          channelType: channelInfo.type,
          isThread: channelInfo.isThread,
          error:
            replyError instanceof Error ? replyError.message : "Unknown error",
        });

        try {
          if (
            "send" in message.channel &&
            typeof message.channel.send === "function"
          ) {
            await message.channel.send(response);
            this.logger.info("Sent fallback message after reply failure");
          }
        } catch (sendError) {
          this.logger.error("Failed to send fallback message", {
            error:
              sendError instanceof Error ? sendError.message : "Unknown error",
          });
          throw sendError;
        }
      }

      await this.conversationManager.updateContext(
        message.author.id,
        message.channelId,
        message.content,
        response
      );

      this.logger.info("Successfully responded to message", {
        user: message.author.tag,
        responseLength: response.length,
        channelType: channelInfo.type,
        isThread: channelInfo.isThread,
      });
    } catch (error) {
      this.handleMessageError(error, message);
    }
  }

  private getChannelInfo(message: Message) {
    const channel = message.channel;
    const isThread = this.isThreadChannel(channel);
    return {
      type: channel.type,
      isThread,
      name: this.getChannelName(channel) || "Unknown",
      threadParent: isThread && "parentId" in channel ? channel.parentId : null,
    };
  }

  private isThreadChannel(channel: TextBasedChannel): boolean {
    return (
      channel.type === ChannelType.PublicThread ||
      channel.type === ChannelType.PrivateThread ||
      channel.type === ChannelType.AnnouncementThread
    );
  }

  private getChannelName(channel: TextBasedChannel): string | null {
    if ("name" in channel && typeof channel.name === "string") {
      return channel.name;
    }
    if (
      channel.type === ChannelType.DM &&
      "recipient" in channel &&
      channel.recipient
    ) {
      return `DM with ${channel.recipient.username}`;
    }
    return null;
  }

  private async shouldProcessMessage(
    message: Message,
    botUser: User
  ): Promise<{ should: boolean; reason?: string }> {
    const isMentioned = message.mentions.has(botUser);
    const isNameMentioned = message.content.toLowerCase().includes("snurbo");
    const isDM = message.channel.type === ChannelType.DM;
    const channelInfo = this.getChannelInfo(message);

    if (isDM) return { should: true, reason: "DM" };
    if (isMentioned) return { should: true, reason: "@mention" };
    if (isNameMentioned) return { should: true, reason: "name mention" };

    if (channelInfo.isThread) {
      const analysis = this.messageAnalyzer.analyzeMessage(message.content);
      if (analysis.isQuestion && analysis.confidence > 0.4) {
        return { should: true, reason: "question in thread" };
      }

      const threadActivity = this.getChannelActivity(message.channelId);
      if (threadActivity < 8) {
        const shouldRespond = this.conversationManager.shouldRespond(
          message.content,
          false,
          false,
          threadActivity
        );
        if (shouldRespond) {
          return { should: true, reason: "random response in thread" };
        }
      }
    } else {
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
      if (shouldRespond) {
        return { should: true, reason: "random response" };
      }
    }

    return { should: false };
  }

  private checkRateLimits(message: Message): boolean {
    const channelInfo = this.getChannelInfo(message);

    if (!this.rateLimiter.checkUserLimit(message.author.id, 15)) {
      this.logger.warn("Rate limit hit for user", {
        user: message.author.tag,
        channelType: channelInfo.type,
        isThread: channelInfo.isThread,
      });
      return false;
    }

    const channelLimit = channelInfo.isThread ? 15 : 10;
    if (!this.rateLimiter.checkChannelLimit(message.channelId, channelLimit)) {
      this.logger.warn("Rate limit hit for channel", {
        channelId: message.channelId,
        channelType: channelInfo.type,
        isThread: channelInfo.isThread,
        limit: channelLimit,
      });
      return false;
    }

    return true;
  }

  private handleMessageError(error: unknown, message: Message): void {
    const channelInfo = this.getChannelInfo(message);

    this.logger.error("Error handling message", {
      user: message.author.tag,
      messageId: message.id,
      channelId: message.channelId,
      channelType: channelInfo.type,
      isThread: channelInfo.isThread,
      threadParent: channelInfo.threadParent,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (Math.random() < 0.3) {
      const errorResponses = [
        "having some issues right now, try again?",
        "brain.exe stopped working momentarily",
        "technical difficulties on my end, give me a sec",
        "something went wrong there, try rephrasing?",
      ];

      const errorResponse =
        errorResponses[Math.floor(Math.random() * errorResponses.length)];
      message.reply(errorResponse).catch((replyError) => {
        this.logger.error("Failed to send error message", {
          channelId: message.channelId,
          error:
            replyError instanceof Error ? replyError.message : "Unknown error",
        });
      });
    }
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
      const aiStats = this.aiService.getStats();
      this.logger.info("Bot statistics", {
        activeContexts: stats.activeContexts,
        totalMessages: stats.totalMessages,
        activeChannels: this.channelActivity.size,
        aiModel: aiStats.model,
        aiHealthy: aiStats.isHealthy,
        cacheSize: aiStats.cache.size,
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
      ai: this.aiService.getStats(),
    };
  }

  shutdown(): void {
    this.conversationManager.shutdown();
    this.logger.info("Message handler shutdown complete");
  }
}
