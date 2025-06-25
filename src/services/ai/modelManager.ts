import { Logger } from "@/utils/logger";

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export class ModelManager {
  private logger: Logger;
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:11434") {
    this.logger = new Logger({ service: "model-manager" });
    this.baseUrl = baseUrl;
  }

  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      this.logger.warn("Failed to fetch available models", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  async selectOptimalModel(preferredModel: string): Promise<string> {
    const available = await this.getAvailableModels();
    const availableNames = available.map((m) => m.name);

    if (availableNames.includes(preferredModel)) {
      this.logger.info("Using preferred model", { model: preferredModel });
      return preferredModel;
    }

    const fallbacks = [
      "llama3.1:8b",
      "gemma2:2b",
      "qwen2.5:7b",
      "llama3.1:latest",
      "gemma2:latest",
    ];

    const fallback = fallbacks.find((model) => availableNames.includes(model));
    if (fallback) {
      this.logger.warn("Preferred model not found, using fallback", {
        preferredModel,
        fallbackModel: fallback,
      });
      return fallback;
    }

    if (availableNames.length > 0) {
      const firstAvailable = availableNames[0];
      this.logger.warn("No preferred models found, using first available", {
        model: firstAvailable,
        availableModels: availableNames,
      });
      return firstAvailable;
    }

    this.logger.error("No models available", {
      preferredModel,
      suggestion: `Please install a model: ollama pull ${preferredModel}`,
    });
    return preferredModel;
  }

  async validateModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  formatModelInfo(models: OllamaModel[]): string {
    if (models.length === 0) return "No models available";

    return models
      .map((model) => `${model.name} (${(model.size / 1e9).toFixed(1)}GB)`)
      .join(", ");
  }
}
