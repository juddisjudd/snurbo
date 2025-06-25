import { ConversationContext, OllamaResponse } from "@/core/types";
import { ResponseProcessor } from "./responseProcessor";
import { ResponseCache } from "./responseCache";
import { ModelManager } from "./modelManager";
import { ContextBuilder } from "@/services/conversation/contextBuilder";
import { ConversationAnalyzer } from "@/services/conversation/conversationAnalyzer";
import { config, responseConfig } from "@/config";
import { Logger } from "@/utils/logger";

export class AIService {
  private baseUrl: string;
  private model: string;
  private responseProcessor: ResponseProcessor;
  private responseCache: ResponseCache;
  private modelManager: ModelManager;
  private contextBuilder: ContextBuilder;
  private conversationAnalyzer: ConversationAnalyzer;
  private logger: Logger;

  constructor() {
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.model;
    this.responseProcessor = new ResponseProcessor();
    this.responseCache = new ResponseCache();
    this.modelManager = new ModelManager(this.baseUrl);
    this.contextBuilder = new ContextBuilder();
    this.conversationAnalyzer = new ConversationAnalyzer();
    this.logger = new Logger({ service: "ai-service" });

    this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    try {
      const optimalModel = await this.modelManager.selectOptimalModel(
        this.model
      );
      if (optimalModel !== this.model) {
        this.model = optimalModel;
        this.logger.info("Using optimal model", { model: this.model });
      }
    } catch (error) {
      this.logger.warn(
        "Failed to initialize optimal model, using configured model",
        {
          configuredModel: this.model,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      );
    }
  }

  async generateResponse(
    message: string,
    context: ConversationContext,
    requiresCode = false
  ): Promise<string> {
    try {
      if (
        this.conversationAnalyzer.shouldAcknowledgeSupport(context.messages)
      ) {
        const supportResponses = [
          "Aww, thanks for having my back!",
          "You're the best! Thanks for sticking up for me",
          "My hero! Thanks for the support!",
          "That means a lot, thanks for defending me!",
          "Appreciate you having my back there!",
          "Aw thanks! You're too kind sticking up for me",
          "That's so sweet of you to defend me!",
        ];
        const response =
          supportResponses[Math.floor(Math.random() * supportResponses.length)];
        this.responseCache.set(message, context.userId, response);
        return response;
      }

      if (!requiresCode) {
        const cached = this.responseCache.get(message, context.userId);
        if (cached) {
          this.logger.debug("Cache hit for message", {
            userId: context.userId,
          });
          return cached;
        }
      }

      const quickResponse = this.getQuickResponse(message.toLowerCase().trim());
      if (quickResponse && !requiresCode) {
        this.responseCache.set(message, context.userId, quickResponse);
        return quickResponse;
      }

      const systemPrompt = this.contextBuilder.buildSystemPrompt(
        context,
        requiresCode
      );
      const messages = this.contextBuilder.buildMessages(
        context,
        message,
        systemPrompt
      );

      const response = await this.callOllamaWithRetry(messages, requiresCode);
      const processedResponse = this.responseProcessor.process(
        response,
        requiresCode
      );

      if (!requiresCode) {
        this.responseCache.set(message, context.userId, processedResponse);
      }

      return processedResponse;
    } catch (error) {
      this.logger.error("AI Service Error", error, {
        userId: context.userId,
        messageLength: message.length,
        requiresCode,
      });
      return this.getFallbackResponse();
    }
  }

  private async callOllamaWithRetry(
    messages: any[],
    requiresCode: boolean,
    retries = 2
  ): Promise<string> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.callOllama(messages, requiresCode);
      } catch (error) {
        if (attempt === retries) throw error;

        this.logger.warn("Ollama call failed, retrying", {
          attempt: attempt + 1,
          totalAttempts: retries + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  private async callOllama(
    messages: any[],
    requiresCode: boolean
  ): Promise<string> {
    const maxTokens = requiresCode
      ? responseConfig.codeMaxTokens
      : responseConfig.maxTokens;

    const requestBody = {
      model: this.model,
      messages,
      temperature: responseConfig.temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data: OllamaResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in response");
    }

    return content;
  }

  private getQuickResponse(message: string): string | null {
    const quickResponses: Record<string, string[]> = {
      yo: ["yo", "hey", "what's good"],
      hey: ["hey", "yo", "what's up"],
      hi: ["hey", "hi", "yo"],
      hello: ["hey", "hello", "yo"],
      thanks: ["np", "no worries", "anytime", "you got it"],
      "thank you": ["no problem", "anytime", "np", "sure thing"],
      lol: ["lol", "haha", "lmao"],
      lmao: ["lmao", "haha", "that's funny"],
      nice: ["nice", "cool", "solid"],
      cool: ["cool", "nice", "yeah"],
      bye: ["later", "see ya", "peace out"],
      gtg: ["later", "see ya", "catch you later"],
      brb: ["alright", "later", "catch you in a bit"],
      gm: ["morning!", "hey", "good morning"],
      gn: ["night!", "sleep well", "later"],
      "good morning": ["morning!", "hey there", "good morning"],
      "good night": ["night!", "sleep well", "sweet dreams"],
    };

    if (quickResponses[message]) {
      const responses = quickResponses[message];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    return null;
  }

  private getFallbackResponse(): string {
    const fallbacks = [
      "brain.exe stopped working",
      "connection timeout, try again?",
      "having some lag here",
      "processing... please wait",
      "system overload, give me a sec",
      "my circuits are crossed lol",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getStats() {
    return {
      model: this.model,
      cache: this.responseCache.getStats(),
    };
  }
}
