import { KnowledgeBase, SearchResult } from "./knowledgeBase";
import { Logger } from "@/utils/logger";

export class KnowledgeService {
  private knowledgeBase: KnowledgeBase;
  private logger: Logger;

  constructor() {
    this.knowledgeBase = new KnowledgeBase();
    this.logger = new Logger({
      service: "snurbo",
      component: "knowledge-service",
    });
  }

  async searchKnowledge(query: string): Promise<string | null> {
    try {
      const results = this.knowledgeBase.search(query, 3);

      if (results.length === 0) {
        return null;
      }

      return this.formatKnowledgeResponse(results);
    } catch (error) {
      this.logger.error("Knowledge search failed", error, { query });
      return null;
    }
  }

  private formatKnowledgeResponse(results: SearchResult[]): string {
    let response = "Here's what I found in my knowledge base:\n\n";

    for (const result of results) {
      response += `**${result.entry.relativePath}** (${result.entry.type}):\n`;

      if (result.entry.summary) {
        response += `${result.entry.summary}\n`;
      }

      if (result.matchedSections.length > 0) {
        response += `\nRelevant sections:\n`;
        result.matchedSections.forEach((section) => {
          response += `> ${section.replace(/\n/g, "\n> ")}\n\n`;
        });
      }

      response += "---\n";
    }

    return response.trim();
  }

  shouldSearchKnowledge(message: string): boolean {
    const knowledgeIndicators = [
      /what do you know about/i,
      /tell me about/i,
      /search.*for/i,
      /find.*info/i,
      /look up/i,
      /check.*knowledge/i,

      /do you have.*info/i,
      /know anything about/i,
      /what.*can.*tell.*about/i,
      /info.*on/i,
      /details.*about/i,
      /explain.*how/i,
      /help.*with/i,
      /guidance.*on/i,
      /how.*do.*i/i,
      /show.*me.*how/i,
      /need.*help.*with/i,
      /what.*is/i,
      /definition.*of/i,

      /about.*yourself/i,
      /your.*capabilities/i,
      /what.*can.*you.*do/i,
      /features/i,
      /commands/i,
      /help$/i,

      /documentation/i,
      /reference/i,
      /tutorial/i,
      /guide/i,
      /manual/i,
      /readme/i,
    ];

    if (knowledgeIndicators.some((pattern) => pattern.test(message))) {
      return true;
    }

    const commonTopics = [
      /snurbo/i,
      /bot/i,
      /discord/i,
      /typescript/i,
      /javascript/i,
      /ollama/i,
      /ai/i,
      /model/i,
      /configuration/i,
      /setup/i,
      /install/i,
    ];

    const isQuestion =
      /\?/.test(message) ||
      /^(what|how|why|when|where|who|which|can|could|would|should|will|is|are|do|does|did)/i.test(
        message.trim()
      );
    const hasCommonTopic = commonTopics.some((pattern) =>
      pattern.test(message)
    );

    return isQuestion && hasCommonTopic;
  }

  getStats() {
    return this.knowledgeBase.getStats();
  }

  refreshKnowledge(): void {
    this.knowledgeBase.refreshIndex();
  }
}
