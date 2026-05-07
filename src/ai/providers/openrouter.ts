import { AIProvider, AIResponse } from "../types";

export class OpenRouterProvider implements AIProvider {
  name: "openrouter" = "openrouter";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
  }

  async generateText(prompt: string, images?: string[]): Promise<AIResponse> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "PhotoAssistAI"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API Error: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      provider: this.name
    };
  }
}
