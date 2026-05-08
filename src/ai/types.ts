export type AIProviderName = 'gemini' | 'groq' | 'openrouter' | 'together' | 'openai';

export interface AIResponse {
  text: string;
  provider: AIProviderName;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AIProvider {
  name: AIProviderName;
  generateText(prompt: string, images?: string[]): Promise<AIResponse>;
}

export interface RouterConfig {
  providers: AIProviderName[];
  retries: number;
  cooldownMs: number;
}
