import { ResponseFormatter } from "@/services/discord/responseFormatter";

export class ResponseProcessor {
  private formatter: ResponseFormatter;

  constructor() {
    this.formatter = new ResponseFormatter();
  }

  process(content: string, requiresCode = false): string {
    let processed = this.cleanContent(content);

    processed = this.formatter.formatForDiscord(processed, requiresCode);

    processed = this.ensureLength(processed);
    processed = this.addVariety(processed);

    return processed;
  }

  private cleanContent(content: string): string {
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");

    return cleaned.trim();
  }

  private ensureLength(content: string): string {
    if (content.length > 300) {
      const sentences = content.split(/[.!?]+/);
      content = sentences.slice(0, 2).join(". ");
      if (!content.match(/[.!?]$/)) {
        content += ".";
      }
    }
    return content;
  }

  private addVariety(content: string): string {
    if (Math.random() < 0.05) {
      const reactions = ["😊", "🤔", "👍", "😄", "🙂"];
      content += " " + reactions[Math.floor(Math.random() * reactions.length)];
    }
    return content;
  }
}
