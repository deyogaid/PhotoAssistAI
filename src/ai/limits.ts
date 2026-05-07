import { AIProviderName } from "./types";

class RateLimiter {
  private cooldowns: Map<AIProviderName, number> = new Map();

  setCooldown(provider: AIProviderName, durationMs: number) {
    this.cooldowns.set(provider, Date.now() + durationMs);
  }

  isAvailable(provider: AIProviderName): boolean {
    const cooldownUntil = this.cooldowns.get(provider) || 0;
    return Date.now() > cooldownUntil;
  }
}

export const aiRateLimiter = new RateLimiter();
