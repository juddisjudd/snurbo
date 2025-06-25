export class MessageAnalyzer {
  analyzeMessage(content: string): {
    isQuestion: boolean;
    requiresCode: boolean;
    confidence: number;
  } {
    const isQuestion = this.detectQuestion(content);
    const requiresCode = this.detectCodeRequest(content);
    const confidence = this.calculateConfidence(content, isQuestion);

    return {
      isQuestion,
      requiresCode,
      confidence,
    };
  }

  private detectQuestion(content: string): boolean {
    const questionPatterns = [
      /\?$/,
      /^(what|how|why|when|where|who|which|can|could|would|should|will|is|are|do|does|did)/i,
      /\b(explain|help|show|tell|teach|guide)\b/i,
      /\b(what's|how's|where's|when's|why's)\b/i,
    ];

    return questionPatterns.some((pattern) => pattern.test(content.trim()));
  }

  private detectCodeRequest(content: string): boolean {
    const codeKeywords = [
      /\b(code|function|class|method|algorithm|script|program)\b/i,
      /\b(write|create|make|build|implement|show)\s+.*\b(code|function|script)\b/i,
      /\b(how\s+to\s+.*(?:code|program|implement|write))/i,
      /\b(example|sample).*\b(code|function|script)\b/i,
      /\bcode\s+for\b/i,
      /\bloop\b.*\b(example|how|code)\b/i,
    ];

    return codeKeywords.some((pattern) => pattern.test(content));
  }

  private calculateConfidence(content: string, isQuestion: boolean): number {
    let confidence = 0.1;

    if (isQuestion) confidence += 0.4;
    if (content.length > 20) confidence += 0.1;
    if (/\b(help|explain|show)\b/i.test(content)) confidence += 0.2;
    if (content.includes("?")) confidence += 0.2;

    return Math.min(confidence, 1.0);
  }
}
