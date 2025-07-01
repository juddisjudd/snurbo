import { ResponseFormatter } from "@/services/discord/responseFormatter";

export class ResponseProcessor {
  private formatter: ResponseFormatter;

  constructor() {
    this.formatter = new ResponseFormatter();
  }

  process(content: string, requiresCode = false): string {
    let processed = this.cleanContent(content);
    processed = this.formatter.formatForDiscord(processed, requiresCode);
    processed = this.ensureLength(processed, requiresCode);
    processed = this.addVariety(processed);
    return processed;
  }

  private cleanContent(content: string): string {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");
    return cleaned.trim();
  }

  private ensureLength(content: string, requiresCode: boolean): string {
    const maxLength = requiresCode ? 400 : 200;

    if (content.length > maxLength) {
      const sentences = content.split(/[.!?]+/);

      if (content.length > maxLength * 1.5) {
        content = sentences[0];
        if (!content.match(/[.!?]$/)) {
          content += ".";
        }
      } else {
        let result = sentences[0];
        if (
          sentences[1] &&
          (result + ". " + sentences[1]).length <= maxLength
        ) {
          result += ". " + sentences[1];
        }
        content = result;
        if (!content.match(/[.!?]$/)) {
          content += ".";
        }
      }
    }

    return content;
  }

  private addVariety(content: string): string {
    if (Math.random() < 0.03) {
      const reactions = ["😊", "🤔", "👍", "😄"];
      content += " " + reactions[Math.floor(Math.random() * reactions.length)];
    }
    return content;
  }
}
