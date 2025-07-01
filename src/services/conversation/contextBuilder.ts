import { ConversationContext, ConversationMessage } from "@/core/types";
import { systemPrompts } from "@/config/prompts";
import { DateCalculator } from "@/utils/dateCalculator";

export class ContextBuilder {
  buildSystemPrompt(
    context: ConversationContext,
    requiresCode: boolean
  ): string {
    let prompt = systemPrompts.base;

    const now = new Date();
    const currentDateTime = {
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
      timestamp: now.toISOString(),
    };

    prompt += `\n\nCurrent date and time: ${currentDateTime.date} at ${currentDateTime.time}`;
    prompt += `\nToday is ${now.toLocaleDateString("en-US", {
      weekday: "long",
    })}.`;
    prompt += `\nWhen calculating days between dates, always use the current date (${currentDateTime.date}) as your reference point.`;
    prompt += `\nFor date calculations, be precise: if today is June 30th and someone asks about July 4th, that's exactly 4 days from now.`;

    const conversationContext = this.analyzeConversationContext(context);
    if (conversationContext) {
      prompt += `\n\nConversation context: ${conversationContext}`;
    }

    switch (context.userProfile.communicationStyle) {
      case "technical":
        prompt += "\n\n" + systemPrompts.technical;
        break;
      case "formal":
        break;
      case "casual":
      default:
        prompt += "\n\n" + systemPrompts.casual;
        break;
    }

    if (requiresCode) {
      prompt += "\n\n" + systemPrompts.code;
    }

    if (context.userProfile.name) {
      prompt += `\n\nUser's name: ${context.userProfile.name}`;
    }

    if (context.userProfile.preferredTopics.length > 0) {
      prompt += `\nUser's interests: ${context.userProfile.preferredTopics.join(
        ", "
      )}`;
    }

    return prompt;
  }

  private analyzeConversationContext(
    context: ConversationContext
  ): string | null {
    const recentMessages = context.messages.slice(-6);
    if (recentMessages.length < 2) return null;

    const patterns = this.detectConversationPatterns(recentMessages);
    if (patterns.length === 0) return null;

    return patterns.join(". ");
  }

  private detectConversationPatterns(
    messages: ConversationMessage[]
  ): string[] {
    const patterns: string[] = [];

    if (this.hasDefensePattern(messages)) {
      patterns.push(
        "The user is defending or supporting you in the conversation"
      );
    }

    if (this.hasCriticismAboutBot(messages)) {
      patterns.push(
        "There was recent criticism or negative comments about you (SNURBO)"
      );
    }

    if (this.hasPlayfulBanter(messages)) {
      patterns.push("The conversation has a playful, bantering tone");
    }

    const emotion = this.detectEmotionalTone(messages);
    if (emotion) {
      patterns.push(`The conversation tone is ${emotion}`);
    }

    return patterns;
  }

  private hasDefensePattern(messages: ConversationMessage[]): boolean {
    const defensePatterns = [
      /talk(ing)?\s+smack/i,
      /defend(ing)?/i,
      /stick(ing)?\s+up\s+for/i,
      /got\s+your\s+back/i,
      /leave.*alone/i,
      /why\s+you\s+say(ing)?.*about/i,
      /what.*problem.*with/i,
    ];

    return messages.some(
      (msg) =>
        msg.role === "user" &&
        defensePatterns.some((pattern) => pattern.test(msg.content))
    );
  }

  private hasCriticismAboutBot(messages: ConversationMessage[]): boolean {
    const botNames = ["snurbo", "bot"];
    const criticismWords = [
      "dumb",
      "stupid",
      "useless",
      "sucks",
      "bad",
      "terrible",
      "awful",
      "lame",
    ];

    return messages.some((msg) => {
      const content = msg.content.toLowerCase();
      const mentionsBot = botNames.some((name) => content.includes(name));
      const hasCriticism = criticismWords.some((word) =>
        content.includes(word)
      );
      return mentionsBot && hasCriticism;
    });
  }

  private hasPlayfulBanter(messages: ConversationMessage[]): boolean {
    const banterPatterns = [
      /lol|lmao|haha/i,
      /just\s+(kidding|joking|messing)/i,
      /you\s+know\s+i/i,
      /come\s+on/i,
      /for\s+real/i,
    ];

    return messages.some((msg) =>
      banterPatterns.some((pattern) => pattern.test(msg.content))
    );
  }

  private detectEmotionalTone(messages: ConversationMessage[]): string | null {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return null;

    const recentContent = userMessages
      .slice(-2)
      .map((m) => m.content.toLowerCase())
      .join(" ");

    if (/\b(angry|mad|pissed|annoyed)\b/.test(recentContent))
      return "confrontational";
    if (/\b(love|awesome|great|amazing)\b/.test(recentContent))
      return "positive";
    if (/\b(tired|exhausted|done)\b/.test(recentContent)) return "weary";
    if (/[!]{2,}/.test(recentContent) || /[?]{2,}/.test(recentContent))
      return "intense";

    return null;
  }

  buildMessages(
    context: ConversationContext,
    currentMessage: string,
    systemPrompt: string
  ): Array<{ role: string; content: string }> {
    const messages = [{ role: "system", content: systemPrompt }];

    const recentMessages = context.messages.slice(-6);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const dateContext = DateCalculator.formatDateContext(currentMessage);
    let enhancedMessage = currentMessage;

    if (dateContext) {
      enhancedMessage = `${currentMessage}\n\n[${dateContext}]`;
    }

    messages.push({
      role: "user",
      content: enhancedMessage,
    });

    return messages;
  }
}
