export interface BotConfig {
  token: string;
  clientId: string;
  ollamaBaseUrl: string;
  model: string;
  maxContextMessages: number;
  responseChance: number;
  maxRequestsPerMinute: number;
}

export interface ConversationMessage {
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  userId: string;
}

export interface ThreadContext {
  isThread: boolean;
  parentChannelId: string | null;
  threadName: string | null;
}

export interface ConversationContext {
  userId: string;
  channelId: string;
  messages: ConversationMessage[];
  lastInteraction: Date;
  userProfile: UserProfile;
  threadContext?: ThreadContext;
}

export interface UserProfile {
  name: string;
  preferredTopics: string[];
  communicationStyle: "casual" | "formal" | "technical";
  lastSeen: Date;
}

export interface RateLimitInfo {
  count: number;
  resetTime: number;
}

export interface OllamaResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

export interface ResponseConfig {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface MessageAnalysis {
  isQuestion: boolean;
  requiresCode: boolean;
  confidence: number;
}

export interface ServiceError {
  message: string;
  code?: string;
  status?: number;
  timestamp: Date;
  service: "ollama" | "discord" | "cache" | "rate-limiter";
}

export interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  error?: string;
}

export interface ChannelInfo {
  type: number;
  isThread: boolean;
  name: string;
  threadParent: string | null;
}

export interface BotStats {
  isReady: boolean;
  uptime: number;
  uptimeFormatted: string;
  startTime: string;
  guilds: number;
  users: number;
  channels: number;
  memory: {
    used: number;
    total: number;
    rss: number;
  };
  conversations: {
    activeContexts: number;
    totalMessages: number;
  };
  activeChannels: number;
  ai: {
    model: string;
    baseUrl: string;
    isHealthy: boolean;
    lastHealthCheck: string;
    cache: {
      size: number;
      hitRate: number;
    };
  };
}
