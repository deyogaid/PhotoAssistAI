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
    6. Aspect ratio (MUST be one of: '1:1', '4:5', '5:4', '3:4', '4:3', '9:16', '16:9' based on image dimensions)
    
    Return the result ONLY as a JSON object, no other text:
    {
      "photoType": "string",
      "subjectCount": number,
      "outfitColor": "string",
      "conditions": ["string"],
      "targetStyle": "string",
      "aspectRatio": "string"
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

export async function generateSmartPrompt(
  input: PromptInput, 
  referenceImage?: string | null,
  previousResult?: GenerationResult | null,
  refinementFeedback?: string
): Promise<{ prompt: string; creativeDirection: string }> {
  const systemInstruction = `
    You are a high-end Digital Imaging Specialist and Commercial Photography Director.
    Your objective: Create master-quality image generation prompts and creative direction that translates raw amateurish concepts into world-class studio photography.

    ${previousResult ? `
    REFINEMENT MODE:
    Previous Attempt Prompt: ${previousResult.prompt}
    User Feedback: "${refinementFeedback}"
    Your task is to EVOLVE the previous version based on the feedback while maintaining its core strengths.
    ` : 'NEW GENERATION MODE:'}

    TARGET VISUAL SPECS:
    - CATEGORY: ${input.photoType}
    - SUBJECTS: ${input.subjectCount} person(s)
    - OUTFIT: ${input.outfitColor || 'Professional neutral tones'}
    - FIXING: ${input.conditions.join(', ') || 'Optimizing all elements'}
    - MOOD/STYLE: ${input.targetStyle}
    - INTENSITY: ${input.intensity}% (Affects dramatic contrast and color saturation)
    - ASPECT RATIO: ${input.aspectRatio}

    PHOTOGRAPHY TECHNICAL DIRECTIVES:
    1. LIGHTING: Describe specific light qualities (e.g., "high-key studio lighting with large octabox softbox at 45 degrees", "dramatic Rembrandt lighting with controlled shadows", "subtle rim light for subject separation"). NO studio gear visible.
    2. OPTICS: Reference high-end glass (e.g., "shot on Hasselblad H6D-400c with HC 80mm lens", "sharp focus on eyes with soft f/2.8 bokeh").
    3. TEXTURE & COLOR: Emphasize "ultra-realistic skin pore detail", "organic texture preservation", "accurate color reproduction mapped to Kodak Portra 400 or Fuji 400H stocks".
    4. COMPOSITION: Use "rule of thirds", "eye-level perspective", "clean minimal studio backdrop". Frame strictly for a ${input.aspectRatio} composition.

    ${referenceImage ? "CRITICAL: A reference image of a real person is provided. The output MUST maintain 100% facial identity, anatomical proportions, and individual characteristics of the person in the reference image. Do not genericize the face." : ""}

    OUTPUT FORMAT:
    [PROMPT]: [A single, dense, technical paragraph of text. NO markdown. No lists.]
    [DIRECTION]: [Expert photography advice in Indonesian for the live shoot, covering posing and lighting setup.]
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

    return { prompt, creativeDirection };
  } catch (error) {
    console.error("Gemini Prompt Generation Error:", error);
    throw error;
  }
}

export async function generateImageFromPrompt(
  prompt: string,
  aspectRatio: string,
  referenceImage?: string | null
): Promise<string> {
  try {
    const parts: any[] = [
      { text: `MAINTAIN FACE IDENTITY. HIGH QUALITY PHOTOGRAPHY. ${prompt}` }
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
          aspectRatio: aspectRatio
        }
      }
    });

    for (const part of imageResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return '';
  } catch (err) {
    console.error("Image generation failed:", err);
    throw err;
  }
}

export async function generatePhotoGuidance(
  input: PromptInput, 
  referenceImage?: string | null,
  previousResult?: GenerationResult | null,
  refinementFeedback?: string
): Promise<GenerationResult> {
  const { prompt, creativeDirection } = await generateSmartPrompt(input, referenceImage, previousResult, refinementFeedback);
  const imageUrl = await generateImageFromPrompt(prompt, input.aspectRatio, referenceImage);

  return {
    prompt,
    creativeDirection,
    imageUrl,
    input
  };
}
