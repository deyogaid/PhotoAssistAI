import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: (import.meta as any).env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});
