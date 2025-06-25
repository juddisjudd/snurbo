export class MessageUtils {
  static extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const stopWords = new Set([
      "this",
      "that",
      "with",
      "from",
      "they",
      "been",
      "have",
      "were",
      "said",
      "each",
      "which",
      "their",
      "time",
      "will",
      "about",
      "would",
      "there",
      "could",
      "other",
      "more",
      "very",
      "what",
      "know",
      "just",
      "first",
      "into",
      "over",
      "think",
      "also",
      "your",
      "work",
      "life",
      "only",
      "can",
      "still",
      "should",
      "after",
      "being",
      "now",
      "made",
      "before",
    ]);

    return words.filter((word) => !stopWords.has(word));
  }

  static calculateSimilarity(text1: string, text2: string): number {
    const keywords1 = this.extractKeywords(text1);
    const keywords2 = this.extractKeywords(text2);

    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));

    return intersection.size / Math.max(set1.size, set2.size);
  }

  static isCodeRelated(text: string): boolean {
    const codeKeywords = [
      "function",
      "variable",
      "array",
      "object",
      "class",
      "method",
      "algorithm",
      "code",
      "programming",
      "script",
      "syntax",
      "debug",
      "compile",
      "runtime",
      "api",
      "database",
      "framework",
      "library",
    ];

    const textLower = text.toLowerCase();
    return codeKeywords.some((keyword) => textLower.includes(keyword));
  }

  static hasUrgencyMarkers(text: string): boolean {
    const urgencyMarkers = [
      /urgent/i,
      /asap/i,
      /emergency/i,
      /critical/i,
      /important/i,
      /!!/,
      /\?{2,}/,
      /help!/i,
      /stuck/i,
      /broken/i,
      /error/i,
    ];

    return urgencyMarkers.some((marker) => marker.test(text));
  }
}

export class TimeUtils {
  static getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
  }

  static formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
