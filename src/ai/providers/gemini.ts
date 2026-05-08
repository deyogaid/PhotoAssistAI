import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIResponse } from "../types";

export class GeminiProvider implements AIProvider {
  name: "gemini" = "gemini";
  private genAI: GoogleGenAI;

  constructor(apiKey?: string) {
    // @ts-ignore
    this.genAI = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
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

    // Use ai.models.generateContent as required by SDK
    // @ts-ignore
    const response = await this.genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts }
    });

    const text = response.text || "";

    return {
      text,
      provider: this.name
    };
  }
}
