import { ConversationContext, OllamaResponse } from "@/core/types";
import { ResponseProcessor } from "./responseProcessor";
import { ResponseCache } from "./responseCache";
import { ModelManager } from "./modelManager";
import { ContextBuilder } from "@/services/conversation/contextBuilder";
import { ConversationAnalyzer } from "@/services/conversation/conversationAnalyzer";
import { KnowledgeService } from "@/services/knowledge/knowledgeService";
import { config, responseConfig } from "@/config";
import { Logger } from "@/utils/logger";

interface OllamaError {
  message: string;
  code?: string;
  status?: number;
}

export class AIService {
  private baseUrl: string;
  private model: string;
  private responseProcessor: ResponseProcessor;
  private responseCache: ResponseCache;
  private modelManager: ModelManager;
  private contextBuilder: ContextBuilder;
  private conversationAnalyzer: ConversationAnalyzer;
  private knowledgeService: KnowledgeService;
  private logger: Logger;
  private isOllamaHealthy = true;
  private lastHealthCheck = 0;
  private readonly HEALTH_CHECK_INTERVAL = 30000;

  constructor() {
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.model;
    this.responseProcessor = new ResponseProcessor();
    this.responseCache = new ResponseCache();
    this.modelManager = new ModelManager(this.baseUrl);
    this.contextBuilder = new ContextBuilder();
    this.conversationAnalyzer = new ConversationAnalyzer();
    this.knowledgeService = new KnowledgeService();
    this.logger = new Logger({ service: "snurbo", component: "ai-service" });
    this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    try {
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        this.logger.error(
          "Ollama service is not accessible during initialization",
          {
            baseUrl: this.baseUrl,
            model: this.model,
          }
        );
        return;
      }

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
          suggestion: "Ensure Ollama is running and the model is available",
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
      if (!(await this.ensureOllamaHealth())) {
        return this.getServiceUnavailableResponse();
      }

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

      let knowledgeContext = "";
      if (this.knowledgeService.shouldSearchKnowledge(message)) {
        const knowledgeResult = await this.knowledgeService.searchKnowledge(
          message
        );
        if (knowledgeResult) {
          knowledgeContext = `\n\nKnowledge Base Results:\n${knowledgeResult}`;
          this.logger.info("Knowledge base search performed", {
            userId: context.userId,
            hasResults: !!knowledgeResult,
          });
        }
      }

      if (!requiresCode && !knowledgeContext) {
        const cached = this.responseCache.get(message, context.userId);
        if (cached) {
          this.logger.debug("Cache hit for message", {
            userId: context.userId,
          });
          return cached;
        }
      }

      if (!knowledgeContext) {
        const quickResponse = this.getQuickResponse(
          message.toLowerCase().trim()
        );
        if (quickResponse && !requiresCode) {
          this.responseCache.set(message, context.userId, quickResponse);
          return quickResponse;
        }
      }

      const systemPrompt = this.contextBuilder.buildSystemPrompt(
        context,
        requiresCode
      );
      const enhancedMessage = message + knowledgeContext;
      const messages = this.contextBuilder.buildMessages(
        context,
        enhancedMessage,
        systemPrompt
      );

      const response = await this.callOllamaWithRetry(messages, requiresCode);
      const processedResponse = this.responseProcessor.process(
        response,
        requiresCode
      );

      if (!requiresCode && !knowledgeContext) {
        this.responseCache.set(message, context.userId, processedResponse);
      }

      return processedResponse;
    } catch (error) {
      return this.handleAIError(
        error,
        context.userId,
        message.length,
        requiresCode
      );
    }
  }

  private async ensureOllamaHealth(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck > this.HEALTH_CHECK_INTERVAL) {
      this.isOllamaHealthy = await this.healthCheck();
      this.lastHealthCheck = now;
    }
    return this.isOllamaHealthy;
  }

  private async callOllamaWithRetry(
    messages: any[],
    requiresCode: boolean,
    retries = 2
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.callOllama(messages, requiresCode);
      } catch (error) {
        lastError = error as Error;
        if (attempt === retries) {
          throw lastError;
        }

        this.logger.warn("Ollama call failed, retrying", {
          attempt: attempt + 1,
          totalAttempts: retries + 1,
          willRetry: attempt < retries,
          error: lastError.message,
        });

        this.isOllamaHealthy = false;
        this.lastHealthCheck = 0;

        const baseDelay = 1000 * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Max retries exceeded");
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

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Ollama API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += ` - ${
            errorJson.error || errorJson.message || "Unknown error"
          }`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        throw new OllamaServiceError(errorMessage, response.status);
      }

      const data: OllamaResponse = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new OllamaServiceError("No content in response from Ollama");
      }

      return content;
    } catch (error) {
      if (error instanceof OllamaServiceError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OllamaServiceError(
          "Cannot connect to Ollama service. Is it running?",
          503
        );
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new OllamaServiceError("Ollama request timeout", 408);
      }

      throw new OllamaServiceError(
        `Unexpected error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500
      );
    }
  }

  private handleAIError(
    error: unknown,
    userId: string,
    messageLength: number,
    requiresCode: boolean
  ): string {
    const errorInfo = {
      userId,
      messageLength,
      requiresCode,
      modelName: this.model,
      baseUrl: this.baseUrl,
    };

    if (error instanceof OllamaServiceError) {
      this.logger.error("Ollama service error", {
        status: error.status,
        ...errorInfo,
        error: error.message,
      });

      switch (error.status) {
        case 503:
          return "Looks like my brain is taking a coffee break ☕ (Ollama service unavailable)";
        case 408:
          return "That's taking longer than expected... try asking something simpler?";
        case 404:
          return `Model '${this.model}' seems to have wandered off. Check if it's installed in Ollama.`;
        case 400:
          return "Something went wrong with that request. Try rephrasing your message?";
        default:
          return "Having some technical difficulties right now. Give me a moment to sort things out.";
      }
    }

    this.logger.error("AI Service Error", {
      ...errorInfo,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return this.getFallbackResponse();
  }

  private getServiceUnavailableResponse(): string {
    const responses = [
      "My AI brain is offline right now 🤖💭",
      "Ollama service seems to be taking a nap... try again in a bit?",
      "Technical difficulties on my end - the AI service isn't responding",
      "Connection to my language model failed. Is Ollama running?",
      "Can't reach my AI backend right now. Try again later?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
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

      const isHealthy = response.ok;
      if (isHealthy) {
        this.logger.debug("Ollama health check passed", {
          baseUrl: this.baseUrl,
        });
      } else {
        this.logger.warn("Ollama health check failed", {
          status: response.status,
          baseUrl: this.baseUrl,
        });
      }

      return isHealthy;
    } catch (error) {
      this.logger.warn("Ollama health check error", {
        baseUrl: this.baseUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  getStats() {
    return {
      model: this.model,
      baseUrl: this.baseUrl,
      isHealthy: this.isOllamaHealthy,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      cache: this.responseCache.getStats(),
      knowledge: this.knowledgeService.getStats(),
    };
  }

  getKnowledgeStats() {
    return this.knowledgeService.getStats();
  }

  refreshKnowledge(): void {
    this.knowledgeService.refreshKnowledge();
    this.logger.info("Knowledge base refreshed");
  }

  async refreshModel(): Promise<string> {
    try {
      this.logger.info("Refreshing model selection...");
      const optimalModel = await this.modelManager.selectOptimalModel(
        this.model
      );
      if (optimalModel !== this.model) {
        const previousModel = this.model;
        this.model = optimalModel;
        this.logger.info("Model updated", {
          previousModel,
          newModel: this.model,
        });
        return `Model switched from ${previousModel} to ${this.model}`;
      } else {
        this.logger.info("Model refresh complete, no changes needed", {
          model: this.model,
        });
        return `Current model ${this.model} is optimal`;
      }
    } catch (error) {
      this.logger.error("Failed to refresh model", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new OllamaServiceError("Failed to refresh model selection");
    }
  }
}

class OllamaServiceError extends Error {
  public readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "OllamaServiceError";
    this.status = status;
  }
}
