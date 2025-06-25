export class ResponseFormatter {
  formatForDiscord(content: string, requiresCode: boolean): string {
    let formatted = content;

    if (requiresCode || this.containsCode(formatted)) {
      formatted = this.formatCodeBlocks(formatted);
    }

    formatted = this.cleanDiscordMarkdown(formatted);

    formatted = this.ensureDiscordLength(formatted);

    return formatted;
  }

  private containsCode(text: string): boolean {
    const codeIndicators = [
      /```[\s\S]*?```/g,
      /`[^`\n]+`/g,
      /function\s+\w+\s*\(/,
      /class\s+\w+\s*{/,
      /(?:const|let|var)\s+\w+\s*=/,
      /import\s+.*from/,
      /console\.log/,
      /if\s*\(.*\)\s*{/,
      /for\s*\(.*\)\s*{/,
      /while\s*\(.*\)\s*{/,
    ];

    return codeIndicators.some((pattern) => pattern.test(text));
  }

  private formatCodeBlocks(content: string): string {
    if (content.includes("```")) {
      return content;
    }

    if (this.isFullCodeResponse(content)) {
      const language = this.detectLanguage(content);
      return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
    }

    return content.replace(
      /(?:^|\s)([a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$.]*\s*=\s*[^;]+;?)(?=\s|$)/g,
      (match) => {
        if (match.trim().length > 3) {
          return ` \`${match.trim()}\``;
        }
        return match;
      }
    );
  }

  private isFullCodeResponse(content: string): boolean {
    const codeLines = content
      .split("\n")
      .filter((line) =>
        /^[\s]*(?:function|class|const|let|var|if|for|while|import|export|\{|\}|;|\/\/)/.test(
          line
        )
      );
    const totalLines = content.split("\n").length;

    return codeLines.length > totalLines * 0.6;
  }

  private detectLanguage(code: string): string {
    if (/import.*from|export|const|let|=>|interface|type/.test(code))
      return "typescript";
    if (/function|var|console\.log|document\./.test(code)) return "javascript";
    if (/def\s+\w+|import\s+\w+|print\(/.test(code)) return "python";
    if (/public\s+class|System\.out|import\s+java/.test(code)) return "java";
    if (/#include|int\s+main|std::|cout/.test(code)) return "cpp";
    if (/fn\s+\w+|let\s+mut|println!/.test(code)) return "rust";
    if (/SELECT|FROM|WHERE|INSERT|UPDATE/i.test(code)) return "sql";
    if (/<[^>]+>/.test(code)) return "html";
    if (/\{[\s\S]*\}|@media|\.[\w-]+\s*\{/.test(code)) return "css";
    return "javascript";
  }

  private cleanDiscordMarkdown(content: string): string {
    let cleaned = content;

    cleaned = cleaned.replace(/^\*\*([^*]+)\*\*$/gm, "$1");

    cleaned = cleaned.replace(/^#{1,6}\s+/gm, "**");

    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned.trim();
  }

  private ensureDiscordLength(content: string): string {
    const maxLength = 2000;

    if (content.length <= maxLength) {
      return content;
    }

    const sentences = content.split(/[.!?]+/);
    let result = "";

    for (const sentence of sentences) {
      if ((result + sentence).length > maxLength - 50) {
        result += "... (truncated)";
        break;
      }
      result += sentence + ".";
    }

    return result || content.substring(0, maxLength - 20) + "... (truncated)";
  }
}
