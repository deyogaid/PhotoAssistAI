import { GeminiProvider } from "./providers/gemini";
import { GroqProvider } from "./providers/groq";
import { OpenRouterProvider } from "./providers/openrouter";
import { OpenAIProvider } from "./providers/openai";
import { TogetherProvider } from "./providers/together";
import { AIProvider, AIProviderName, AIResponse, RouterConfig } from "./types";
import { aiRateLimiter } from "./limits";

export class AIRouter {
  private providers: Map<AIProviderName, AIProvider> = new Map();
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = config;
    this.initProviders();
  }

  private initProviders(userKeys?: Partial<Record<AIProviderName, string>>) {
    this.providers.set('gemini', new GeminiProvider(userKeys?.gemini));
    this.providers.set('groq', new GroqProvider(userKeys?.groq));
    this.providers.set('openrouter', new OpenRouterProvider(userKeys?.openrouter));
    this.providers.set('openai', new OpenAIProvider(userKeys?.openai));
    this.providers.set('together', new TogetherProvider(userKeys?.together));
  }

  updateUserKeys(keys: Partial<Record<AIProviderName, string>>) {
    this.initProviders(keys);
  }

  async generateText(prompt: string, images?: string[]): Promise<AIResponse> {
    let lastError: any = null;

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      for (const providerName of this.config.providers) {
        if (!aiRateLimiter.isAvailable(providerName)) continue;

        const provider = this.providers.get(providerName);
        if (!provider) continue;

        try {
          const response = await provider.generateText(prompt, images);
          return response;
        } catch (error: any) {
          lastError = error;
          console.warn(`Provider ${providerName} failed:`, error.message);

          // If rate limited (429), set cooldown
          if (error.message.includes('429') || error.message.toLowerCase().includes('quota')) {
            aiRateLimiter.setCooldown(providerName, this.config.cooldownMs);
          }
          
          // Continue to next provider in fallback chain
          continue;
        }
      }
      
      // Wait a bit before next retry cycle if all providers failed
      if (attempt < this.config.retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw lastError || new Error("All AI providers failed and no fallback available.");
  }
}

// Default instance for the app
export const aiRouter = new AIRouter({
  providers: ['gemini', 'groq', 'openrouter'],
  retries: 2,
  cooldownMs: 60000 // 1 minute cooldown on 429
});
