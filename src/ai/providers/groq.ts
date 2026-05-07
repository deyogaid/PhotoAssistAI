import { AIProvider, AIResponse } from "../types";

export class GroqProvider implements AIProvider {
  name: "groq" = "groq";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || "";
  }

  async generateText(prompt: string, images?: string[]): Promise<AIResponse> {
    if (images && images.length > 0) {
      // Groq vision models might require specific handling or model names
      // Defaulting to a vision-capable model if available, else fallback text
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Groq API Error: ${error?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      provider: this.name
    };
  }
}
