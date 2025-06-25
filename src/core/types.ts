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
  role: 'user' | 'assistant';
  timestamp: Date;
  userId: string;
}

export interface ConversationContext {
  userId: string;
  channelId: string;
  messages: ConversationMessage[];
  lastInteraction: Date;
  userProfile: UserProfile;
}

export interface UserProfile {
  name: string;
  preferredTopics: string[];
  communicationStyle: 'casual' | 'formal' | 'technical';
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