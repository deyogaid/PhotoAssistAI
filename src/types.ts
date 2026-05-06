
export type PhotoType = 'portrait' | 'wedding' | 'product' | 'fashion' | 'family' | 'event';

export interface StyleOption {
  value: string;
  label: string;
  description: string;
  icon: string;
}

export interface PromptInput {
  photoType: PhotoType;
  subjectCount: number;
  outfitColor: string;
  conditions: string[];
  targetStyle: string;
  intensity: number; // 0 to 100
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  config: Partial<PromptInput>;
}

export interface GenerationResult {
  id?: string;
  prompt: string;
  creativeDirection: string;
  imageUrl?: string;
  input?: PromptInput;
  createdAt?: any;
}
