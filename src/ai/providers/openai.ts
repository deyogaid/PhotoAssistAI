import { AIProvider, AIResponse } from "../types";

export class OpenAIProvider implements AIProvider {
  name: "openai" = "openai";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
  }

  async generateText(prompt: string, images?: string[]): Promise<AIResponse> {
    const messages: any[] = [{ role: "user", content: prompt }];
    
    if (images && images.length > 0) {
      // Vision handling for OpenAI (GPT-4o)
      messages[0].content = [
        { type: "text", text: prompt },
        ...images.map(img => ({
          type: "image_url",
          image_url: { url: img }
        }))
      ];
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: images && images.length > 0 ? "gpt-4o" : "gpt-4o-mini",
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      provider: this.name
    };
  }
}
