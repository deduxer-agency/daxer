export interface Project {
  id: string;
  name: string;
  description: string;
  stylePrompt: string;
  referenceImages: ReferenceImage[];
  characters: Character[];
  createdAt: number;
  updatedAt: number;
}

export interface ReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface Character {
  id: string;
  label: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface GenerationRequest {
  id: string;
  projectId: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  result?: GeneratedImage;
  error?: string;
  settings: GenerationSettings;
  startedAt: number;
}

export interface GeneratedImage {
  id: string;
  projectId: string;
  prompt: string;
  dataUrl: string;
  mimeType: string;
  settings: GenerationSettings;
  createdAt: number;
  parentImageId?: string;
  maskDataUrl?: string; // Selection mask for targeted edits (not persisted)
}

export interface GenerationSettings {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  temperature: number;
  numberOfVariations: number;
  stylePreset: StylePreset;
}

export type StylePreset =
  | 'none'
  | 'photorealistic'
  | 'illustration'
  | 'graphic-design'
  | 'casual-startup'
  | 'artistic';

export type AspectRatio =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9';

export type ImageSize = '1K' | '2K' | '4K';

export interface EditRequest {
  sourceImage: GeneratedImage;
  editPrompt: string;
  settings: GenerationSettings;
}
