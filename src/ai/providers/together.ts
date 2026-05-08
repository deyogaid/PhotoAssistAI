import { AIProvider, AIResponse } from "../types";

export class TogetherProvider implements AIProvider {
  name: "together" = "together";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TOGETHER_API_KEY || "";
  }

  async generateText(prompt: string, images?: string[]): Promise<AIResponse> {
    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Together AI Error: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      provider: this.name
    };
  }
}
