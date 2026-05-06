import { Preset, StyleOption } from './types';

export const PRESETS: Preset[] = [
  {
    id: 'studio-minimal',
    name: 'Studio Clean Minimal',
    description: 'Rapi, elegan, minimalis dengan lighting lembut.',
    config: {
      targetStyle: 'studio-minimalist',
      intensity: 30,
      aspectRatio: '4:5',
    }
  },
  {
    id: 'luxury-wedding',
    name: 'Luxury Wedding',
    description: 'Tone premium untuk momen spesial deyoga.',
    config: {
      photoType: 'wedding',
      targetStyle: 'luxury-editorial',
      intensity: 60,
      aspectRatio: '4:5',
    }
  },
  {
    id: 'family-editorial',
    name: 'Family Editorial',
    description: 'Hasil portrait keluarga sekelas majalah.',
    config: {
      photoType: 'family',
      targetStyle: 'family-magazine',
      intensity: 50,
      aspectRatio: '3:4',
    }
  },
  {
    id: 'soft-natural',
    name: 'Soft Natural Light',
    description: 'Cahaya natural yang lembut dan estetik.',
    config: {
      targetStyle: 'natural-lifestyle',
      intensity: 40,
      aspectRatio: '4:5',
    }
  }
];

export const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1', description: 'Square (IG)' },
  { value: '4:5', label: '4:5', description: 'Portrait (IG)' },
  { value: '5:4', label: '5:4', description: 'Landscape (IG)' },
  { value: '3:4', label: '3:4', description: 'Portrait Standard' },
  { value: '4:3', label: '4:3', description: 'Landscape Standard' },
  { value: '9:16', label: '9:16', description: 'Reels/Stories' },
  { value: '16:9', label: '16:9', description: 'Cinematic/Landscape' },
];

export const PHOTO_TYPES = [
  { value: 'portrait', label: 'Single Portrait' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'family', label: 'Family Group' },
  { value: 'fashion', label: 'Fashion / Editorial' },
  { value: 'product', label: 'Product Photography' },
  { value: 'event', label: 'Event' },
];

export const STYLE_OPTIONS: StyleOption[] = [
  { 
    value: 'studio-minimalist', 
    label: 'Studio Minimalist', 
    description: 'Clean background with soft butterfly lighting.',
    icon: '✨'
  },
  { 
    value: 'luxury-editorial', 
    label: 'Luxury Editorial', 
    description: 'High contrast, magazine-ready aesthetic.',
    icon: '💎'
  },
  { 
    value: 'dramatic-cinema', 
    label: 'Dramatic Cinema', 
    description: 'Moody shadows and atmospheric storytelling.',
    icon: '🎬'
  },
  { 
    value: 'natural-lifestyle', 
    label: 'Natural Lifestyle', 
    description: 'Organic feel with warm, diffused sunlight.',
    icon: '🌿'
  },
  { 
    value: 'vintage-film', 
    label: 'Vintage Film', 
    description: 'Classic analog look with subtle grain and matte tones.',
    icon: '📸'
  },
  { 
    value: 'high-end-fashion', 
    label: 'High-End Fashion', 
    description: 'Avant-garde styling and ultra-sharp details.',
    icon: '👗'
  },
  { 
    value: 'clean-commercial', 
    label: 'Clean Commercial', 
    description: 'Even lighting for product and corporate clarity.',
    icon: '🏢'
  },
];

export const CONDITION_OPTIONS = [
  { value: 'messy-bg', label: 'Background Berantakan' },
  { value: 'harsh-light', label: 'Lighting Terlalu Keras' },
  { value: 'bad-composition', label: 'Komposisi Tidak Rapi' },
  { value: 'low-light', label: 'Kurang Cahaya' },
];
