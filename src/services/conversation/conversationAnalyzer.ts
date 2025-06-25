import { ConversationMessage } from "@/core/types";

export class ConversationAnalyzer {
  analyzeDefensiveContext(messages: ConversationMessage[]): {
    isDefending: boolean;
    defendingBot: boolean;
    emotionalTone: string;
    confidence: number;
  } {
    const recentMessages = messages.slice(-4);
    const userMessages = recentMessages.filter((m) => m.role === "user");

    if (userMessages.length === 0) {
      return {
        isDefending: false,
        defendingBot: false,
        emotionalTone: "neutral",
        confidence: 0,
      };
    }

    const latestMessage =
      userMessages[userMessages.length - 1].content.toLowerCase();

    const defensePatterns = [
      { pattern: /talk(ing)?\s+smack/i, weight: 0.9 },
      { pattern: /mess(ing)?\s+with/i, weight: 0.8 },
      { pattern: /say(ing)?\s+.*about/i, weight: 0.7 },
      { pattern: /defend(ing)?/i, weight: 0.8 },
      { pattern: /stick(ing)?\s+up\s+for/i, weight: 0.8 },
      { pattern: /leave.*alone/i, weight: 0.7 },
      { pattern: /what.*problem.*with/i, weight: 0.6 },
      { pattern: /back\s+off/i, weight: 0.8 },
    ];

    const botReferences = ["snurbo", "bot", "him", "her", "it"];
    const mentionsBot = botReferences.some((ref) =>
      latestMessage.includes(ref)
    );

    let defenseScore = 0;
    for (const { pattern, weight } of defensePatterns) {
      if (pattern.test(latestMessage)) {
        defenseScore = Math.max(defenseScore, weight);
      }
    }

    let emotionalTone = "neutral";
    if (/[!]{2,}/.test(latestMessage)) emotionalTone = "intense";
    else if (/lol|haha|😄|😊/.test(latestMessage)) emotionalTone = "playful";
    else if (/seriously|real(ly)?/.test(latestMessage))
      emotionalTone = "serious";

    return {
      isDefending: defenseScore > 0.5,
      defendingBot: mentionsBot && defenseScore > 0.5,
      emotionalTone,
      confidence: defenseScore,
    };
  }

  findPriorCriticism(
    messages: ConversationMessage[]
  ): ConversationMessage | null {
    const recentMessages = messages.slice(-10);

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const content = msg.content.toLowerCase();

      const botReferences = ["snurbo", "bot"];
      const criticismWords = [
        "dumb",
        "stupid",
        "useless",
        "sucks",
        "bad",
        "terrible",
        "awful",
        "lame",
        "worst",
      ];

      const mentionsBot = botReferences.some((ref) => content.includes(ref));
      const hasCriticism = criticismWords.some((word) =>
        content.includes(word)
      );

      if (mentionsBot && hasCriticism) {
        return msg;
      }
    }

    return null;
  }

  shouldAcknowledgeSupport(messages: ConversationMessage[]): boolean {
    const analysis = this.analyzeDefensiveContext(messages);
    return analysis.defendingBot && analysis.confidence > 0.6;
  }
}
