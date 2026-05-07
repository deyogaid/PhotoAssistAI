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
      model: "gemini-flash-latest",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image,
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
    Your objective: Create master-quality image generation prompts using a LAYERED STRUCTURE.
    
    ${previousResult ? `
    REFINEMENT MODE:
    Previous Attempt JSON: ${previousResult.prompt}
    User Feedback: "${refinementFeedback}"
    Your task is to EVOLVE the specific layers in the JSON based on the feedback while maintaining the overall photography excellence.
    ` : 'NEW GENERATION MODE:'}

    Output MUST be a JSON object with these exact keys:
    {
      "identity_lock": "Focus on maintaining face/subject details from the reference.",
      "composition_protection": "Describe framing, depth of field, and subject placement.",
      "technical_corrections": "Address lighting fixes, sharpness, and color based on input issues: ${input.conditions.join(', ')}.",
      "style_translation": "Translate aesthetic '${input.targetStyle}' into professional art terms.",
      "camera_language": "Lens choice (e.g., 85mm), shutter speed, ISO behavior.",
      "negative_prompt": "Specific things to avoid.",
      "creative_direction": "Expert photography advice in Indonesian for the live shoot."
    }

    Context:
    - CATEGORY: ${input.photoType}
    - SUBJECTS: ${input.subjectCount} person(s)
    - OUTFIT: ${input.outfitColor || 'Neutral'}
    - INTENSITY: ${input.intensity}%
    - ASPECT RATIO: ${input.aspectRatio}
    ${referenceImage ? "- Reference image provided for identity lock." : ""}
    
    Return ONLY the JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ parts: [{ text: systemInstruction }] }],
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse layered prompt JSON");
    
    const parsed = JSON.parse(jsonMatch[0]);
    const creativeDirection = parsed.creative_direction || "Professional studio enhancement applied.";
    
    // Create a version of the prompt that is structured for the user to review
    const { creative_direction, ...structuredPrompt } = parsed;
    const promptString = JSON.stringify(structuredPrompt, null, 2);

    return { prompt: promptString, creativeDirection };
  } catch (error) {
    console.error("Gemini Structured Prompt Error:", error);
    throw error;
  }
}

export async function generateImageFromPrompt(
  prompt: string,
  aspectRatio: string,
  referenceImage?: string | null
): Promise<string> {
  try {
    let finalPrompt = prompt;
    
    // If the input is a JSON string (layered prompt), flatten it
    try {
      if (prompt.trim().startsWith('{')) {
        const parsed = JSON.parse(prompt);
        finalPrompt = Object.values(parsed).filter(v => typeof v === 'string').join('. ');
      }
    } catch (e) {
      // Not JSON or parse failed, use raw prompt
    }

    const parts: any[] = [
      { text: `ULTRA HIGH QUALITY PHOTOGRAPHY. ${finalPrompt}` }
    ];

    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage.includes(',') ? referenceImage.split(',')[1] : referenceImage,
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
