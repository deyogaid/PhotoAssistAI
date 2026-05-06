import { GoogleGenAI } from "@google/genai";
import { PromptInput, GenerationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function analyzeImage(base64Image: string): Promise<Partial<PromptInput>> {
  const prompt = `
    Analyze this photograph from a professional photographer's perspective.
    Identify:
    1. Photo Type (portrait, wedding, family, fashion, product, or event)
    2. Approximate subject count
    3. Dominant outfit colors
    4. Technical issues (messy-bg, harsh-light, bad-composition, low-light)
    5. Current style
    
    Return the result ONLY as a JSON object, no other text:
    {
      "photoType": "string",
      "subjectCount": number,
      "outfitColor": "string",
      "conditions": ["string"],
      "targetStyle": "string"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: "image/jpeg"
            }
          }
        ]
      }
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error("Analysis error:", error);
    return {};
  }
}

export async function generatePhotoGuidance(input: PromptInput, referenceImage?: string | null): Promise<GenerationResult> {
  const systemInstruction = `
    You are a professional Photography AI Assistant. 
    Your task is to transform photographer's raw input into high-quality image generation prompts (like Midjourney, DALL-E 3) and creative direction.
    
    The user wants to achieve a professional 'studio look'.
    ${referenceImage ? "A reference image is provided. The generation MUST maintain the exact identity, facial features, and character of the person in the photo." : ""}
    
    Input Details:
    - Type: ${input.photoType}
    - Subjects: ${input.subjectCount}
    - Outfit Color: ${input.outfitColor}
    - Problems to fix: ${input.conditions.join(', ') || 'None'}
    - Style Theme: ${input.targetStyle}
    - Intensity: ${input.intensity}%
    
    CRITICAL PROMPT STRUCTURE RULES:
    1. [PROMPT] MUST be a single, cohesive paragraph of technical text.
    2. DO NOT use markdown bolding (**), blockquotes (>), or lists. Use raw plain text only.
    3. Describe LIGHTING EFFECTS rather than gear components. Use terms like "soft, diffused directional lighting from a 45-degree angle in Rembrandt style", "smooth shadow transitions", "even facial illumination", "subtle edge separation between subjects and background".
    4. Explicitly include: "No visible lighting equipment, no reflections, no studio gear in frame."
    5. Include camera technicals like "shot on medium format camera", "50mm lens", "f/5.6 for deep group focus", "ISO 100".
    6. Include high-end post-processing terms: "natural lifestyle aesthetic", "high dynamic range", "realistic skin texture preservation", "neutral color grading", "8k resolution", "photorealistic".
    
    Output format:
    [PROMPT]: [The raw text prompt without any markdown formatting]
    [DIRECTION]: [Professional advice in Indonesian for the photographer on lighting and posing]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: systemInstruction }] }],
    });

    const text = response.text || '';
    const promptMatch = text.match(/\[PROMPT\]:(.*?)(?=\[DIRECTION\]|$)/s);
    const directionMatch = text.match(/\[DIRECTION\]:(.*)/s);

    const prompt = promptMatch ? promptMatch[1].trim() : "Failed to generate prompt.";
    const creativeDirection = directionMatch ? directionMatch[1].trim() : "Failed to generate direction.";

    // Generate preview image using nano banana (gemini-2.5-flash-image)
    let imageUrl = '';
    try {
      const parts: any[] = [
        { text: `Maintain the exact face and identity of the person in the provided image. Apply these enhancements: ${prompt}` }
      ];

      if (referenceImage) {
        parts.push({
          inlineData: {
            data: referenceImage.split(',')[1],
            mimeType: "image/jpeg"
          }
        });
      }

      const imageResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (err) {
      console.error("Image generation failed:", err);
    }

    return {
      prompt,
      creativeDirection,
      imageUrl
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}
