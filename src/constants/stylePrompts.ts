
export interface StylePrompt {
  background: string;
  lighting: string;
  atmosphere: string;
  negativePrompt?: string;

  composition?: string;
  camera?: string;
  colorGrading?: string;
  renderStyle?: string;
}

export const STYLE_PROMPT_MAP: Record<string, StylePrompt> = {
  // Existing Styles Mapped to new structure
  'studio-minimalist': {
    background: "clean minimalist studio background, neutral grey soft gradient",
    lighting: "soft butterfly lighting, gentle shadows, professional studio setup",
    atmosphere: "clean, elegant, minimalist",
    renderStyle: "high-end commercial photography"
  },
  'luxury-editorial': {
    background: "opulent luxury interior, soft focus premium environment",
    lighting: "high contrast editorial lighting, dramatic highlights",
    atmosphere: "sophisticated, premium, magazine-ready",
    camera: "shot on Phase One XF, ultra-sharp detail",
    colorGrading: "luxury color palette"
  },
  'dramatic-cinema': {
    background: "atmospheric cinematic set, moody environment",
    lighting: "dramatic Rembrandt lighting, deep shadows, cinematic rim light",
    atmosphere: "moody, intense, storytelling vibe",
    renderStyle: "cinematic film aesthetic"
  },
  'natural-lifestyle': {
    background: "organic natural setting, soft foliage or window view",
    lighting: "warm diffused natural sunlight, golden hour glow",
    atmosphere: "organic, relaxed, authentic lifestyle",
    camera: "35mm prime lens, natural bokeh"
  },
  'vintage-film': {
    background: "nostalgic retro setting, slightly blurred background",
    lighting: "soft low-contrast lighting, analog warmth",
    atmosphere: "vintage, nostalgic, classic film look",
    renderStyle: "film grain, matte finish, Kodachrome aesthetic"
  },
  'high-end-fashion': {
    background: "abstract fashion studio or minimalist architectural space",
    lighting: "sharp edgy lighting, high-fashion contrast",
    atmosphere: "avant-garde, bold, stylish",
    camera: "sharp focus, high dynamic range"
  },
  'clean-commercial': {
    background: "clean commercial white or corporate background",
    lighting: "even flat lighting, high clarity, no harsh shadows",
    atmosphere: "professional, sharp, commercial",
    renderStyle: "corporate photography"
  },
  'family-magazine': {
    background: "cozy elegant family home or upscale garden setting",
    lighting: "soft directional light, warm highlighting on faces",
    atmosphere: "warm, loving, high-end editorial vibe",
    camera: "shot on Sony A7R IV, 50mm lens, natural warmth",
    colorGrading: "soft natural tones, high dynamic range"
  },

  // New Cinematic Styles
  'cinematic': {
    background: "epic cinematic landscape or urban vista at dusk",
    lighting: "cinematic teal and orange lighting, dramatic volumetric light",
    atmosphere: "misty, cinematic depth, blockbuster feel",
    composition: "rule of thirds, wide cinematic framing",
    camera: "anamorphic lens, shallow depth of field, 2.39:1 aspect ratio vibe",
    colorGrading: "Hollywood movie grading"
  },
  'luxury': {
    background: "luxurious penthouse interior, marble and gold accents",
    lighting: "glamourous warm lighting, soft shadows, expensive glow",
    atmosphere: "wealthy, elite, sophisticated aesthetic",
    composition: "centered symmetrical portrait",
    camera: "shot on Leica S3, ultimate clarity",
    renderStyle: "polished, ultra-clean"
  },
  'linkedin': {
    background: "blurred professional workspace or modern office",
    lighting: "flattering soft window light, natural and bright",
    atmosphere: "professional, confident, approachable",
    composition: "head and shoulders portrait, eye contact",
    camera: "85mm lens, sharp focus on eyes",
    colorGrading: "natural skin tones, clean balance"
  },
  'streetwear': {
    background: "urban industrial setting, concrete walls, city street corner",
    lighting: "harsh outdoor light, high-contrast shadows",
    atmosphere: "edgy, youth-focused, urban vibes",
    composition: "dynamic low angle or candid street pose",
    camera: "shot on Fujifilm X-T5, street photography style",
    renderStyle: "organic textures, sharp detail"
  },
  'minimalist': {
    background: "empty minimalist space, single geometric element",
    lighting: "subtle soft directional light, delicate shadows",
    atmosphere: "quiet, peaceful, focused",
    composition: "minimalist negative space",
    renderStyle: "clean lines, smooth surfaces"
  },
  'travel': {
    background: "breath-taking travel destination, famous landmark or hidden gem",
    lighting: "golden hour light, warm sun flares",
    atmosphere: "wanderlust, adventure, discovery",
    camera: "wide angle lens, deep depth of field",
    colorGrading: "vibrant travel-blog aesthetic"
  },
  'cyberpunk': {
    background: "futuristic neon-drenched cityscape, rainy night",
    lighting: "neon pink and electric blue lighting, glowing reflections",
    atmosphere: "cybernetic, high-tech, futuristic neonnoir",
    renderStyle: "hyper-realistic, ray-traced reflections"
  },
  'academic': {
    background: "classic dark academia library, rows of antique books",
    lighting: "warm incandescent lamp light, soft moody glow",
    atmosphere: "intellectual, studious, timeless",
    camera: "vintage lens effect, subtle bokeh",
    colorGrading: "sepia and rich dark wood tones"
  }
};

export function buildStylePrompt(styleKey: string): string {
  const style = STYLE_PROMPT_MAP[styleKey];
  if (!style) return "";
  
  return [
    style.background,
    style.lighting,
    style.atmosphere,
    style.composition,
    style.camera,
    style.colorGrading,
    style.renderStyle
  ]
  .filter(Boolean)
  .join(", ");
}
