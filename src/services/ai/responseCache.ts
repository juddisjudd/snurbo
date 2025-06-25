import { MessageUtils } from "@/utils/helpers";

interface CacheEntry {
  response: string;
  timestamp: number;
  similarity: number;
}

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 10 * 60 * 1000;
  private readonly MAX_ENTRIES = 100;
  private readonly SIMILARITY_THRESHOLD = 0.8;

  private getKey(message: string, userId: string): string {
    const normalized = message
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `${normalized}-${userId}`;
  }

  get(message: string, userId: string): string | null {
    this.cleanup();

    const key = this.getKey(message, userId);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.response;
    }

    return this.findSimilarResponse(message, userId);
  }

  private findSimilarResponse(message: string, userId: string): string | null {
    const userEntries = Array.from(this.cache.entries())
      .filter(([key]) => key.endsWith(`-${userId}`))
      .filter(([_, entry]) => Date.now() - entry.timestamp < this.TTL);

    for (const [key, entry] of userEntries) {
      const cachedMessage = key.replace(`-${userId}`, "");
      const similarity = MessageUtils.calculateSimilarity(
        message,
        cachedMessage
      );

      if (similarity >= this.SIMILARITY_THRESHOLD) {
        return entry.response;
      }
    }

    return null;
  }

  set(message: string, userId: string, response: string): void {
    const key = this.getKey(message, userId);
    const similarity = this.calculateMessageComplexity(message);

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      similarity,
    });

    if (this.cache.size > this.MAX_ENTRIES) {
      this.cleanup(true);
    }
  }

  private calculateMessageComplexity(message: string): number {
    const baseScore = Math.min(message.length / 100, 1);
    const hasQuestion = message.includes("?") ? 0.2 : 0;
    const hasCode = MessageUtils.isCodeRelated(message) ? 0.3 : 0;

    return Math.min(baseScore + hasQuestion + hasCode, 1);
  }

  private cleanup(force = false): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    const expired = entries.filter(
      ([_, entry]) => now - entry.timestamp > this.TTL
    );
    expired.forEach(([key]) => this.cache.delete(key));

    if (force && this.cache.size > this.MAX_ENTRIES) {
      const remaining = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      const toRemove = remaining.slice(0, this.cache.size - this.MAX_ENTRIES);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0,
    };
  }
}
