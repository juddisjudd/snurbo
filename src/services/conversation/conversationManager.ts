import type {
  ConversationContext,
  ConversationMessage,
  UserProfile,
} from "@/core/types";
import { config } from "@/config";

export class ConversationManager {
  private contexts = new Map<string, ConversationContext>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldContexts();
    }, 3600000);
  }

  async getContext(
    userId: string,
    channelId: string
  ): Promise<ConversationContext> {
    const contextKey = `${userId}-${channelId}`;
    let context = this.contexts.get(contextKey);

    if (!context) {
      context = this.createNewContext(userId, channelId);
      this.contexts.set(contextKey, context);
    }

    context.lastInteraction = new Date();
    return context;
  }

  async updateContext(
    userId: string,
    channelId: string,
    userMessage: string,
    botResponse: string
  ): Promise<void> {
    const context = await this.getContext(userId, channelId);

    context.messages.push({
      content: userMessage,
      role: "user",
      timestamp: new Date(),
      userId,
    });

    context.messages.push({
      content: botResponse,
      role: "assistant",
      timestamp: new Date(),
      userId: "bot",
    });

    if (context.messages.length > config.maxContextMessages) {
      context.messages = context.messages.slice(-config.maxContextMessages);
    }

    this.updateUserProfile(context, userMessage);
  }

  private createNewContext(
    userId: string,
    channelId: string
  ): ConversationContext {
    return {
      userId,
      channelId,
      messages: [],
      lastInteraction: new Date(),
      userProfile: {
        name: "",
        preferredTopics: [],
        communicationStyle: "casual",
        lastSeen: new Date(),
      },
    };
  }

  private updateUserProfile(
    context: ConversationContext,
    message: string
  ): void {
    const profile = context.userProfile;
    profile.lastSeen = new Date();

    const formalWords = /please|thank you|could you|would you|sir|ma'am/i.test(
      message
    );
    const casualWords = /yeah|yep|nah|lol|haha|omg|wtf|brb/i.test(message);
    const technicalWords =
      /function|variable|array|object|code|programming|debug/i.test(message);

    if (technicalWords) {
      profile.communicationStyle = "technical";
    } else if (formalWords && !casualWords) {
      profile.communicationStyle = "formal";
    } else {
      profile.communicationStyle = "casual";
    }

    const topics = this.extractTopics(message);
    for (const topic of topics) {
      if (
        !profile.preferredTopics.includes(topic) &&
        profile.preferredTopics.length < 10
      ) {
        profile.preferredTopics.push(topic);
      }
    }
  }

  private extractTopics(message: string): string[] {
    const topicKeywords = [
      "gaming",
      "games",
      "music",
      "movies",
      "programming",
      "coding",
      "art",
      "sports",
      "food",
      "travel",
      "books",
      "anime",
      "manga",
      "technology",
      "science",
      "politics",
      "history",
      "philosophy",
      "fitness",
      "cooking",
    ];

    const messageLower = message.toLowerCase();
    return topicKeywords.filter((keyword) => messageLower.includes(keyword));
  }

  shouldRespond(
    message: string,
    isMentioned: boolean,
    isDM: boolean,
    channelActivity: number
  ): boolean {
    if (isDM || isMentioned) return true;

    const isNameMentioned = message.toLowerCase().includes("snurbo");
    if (isNameMentioned) return true;

    if (channelActivity > 5) return false;

    let chance = config.responseChance;

    if (message.includes("?")) chance += 0.1;
    if (/!|😀|😂|😢|😍|🤔/.test(message)) chance += 0.05;
    if (/\b(yo|what's up|wassup)\b/i.test(message)) chance += 0.05;
    if (message.length < 10) chance -= 0.05;

    return Math.random() < Math.max(0, Math.min(1, chance));
  }

  getResponseDelay(messageLength: number): number {
    const words = messageLength / 5;
    const baseDelay = 1000;
    const thinkingTime = Math.min(words * 100, 3000);
    const typingTime = Math.min(words * 50, 2000);
    const randomFactor = 0.5 + Math.random();

    return Math.floor((baseDelay + thinkingTime + typingTime) * randomFactor);
  }

  private cleanupOldContexts(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [key, context] of this.contexts.entries()) {
      const age = now - context.lastInteraction.getTime();
      if (age > maxAge) {
        this.contexts.delete(key);
      }
    }
  }

  getStats() {
    return {
      activeContexts: this.contexts.size,
      totalMessages: Array.from(this.contexts.values()).reduce(
        (sum, ctx) => sum + ctx.messages.length,
        0
      ),
    };
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
