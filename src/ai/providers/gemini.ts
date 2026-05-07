import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIResponse } from "../types";

export class GeminiProvider implements AIProvider {
  name: "gemini" = "gemini";
  private genAI: GoogleGenAI;

  constructor() {
    // @ts-ignore
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  }

  async generateText(prompt: string, images?: string[]): Promise<AIResponse> {
    const parts: any[] = [{ text: prompt }];
    
    if (images) {
      for (const img of images) {
        const base64Data = img.split(',')[1] || img;
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        });
      }
    }

    // @ts-ignore
    const result = await this.genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts }]
    });

    const text = result.text || "";

    return {
      text,
      provider: this.name
    };
  }
}
