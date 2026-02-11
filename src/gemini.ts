import type { GenerationSettings, Project, GeneratedImage } from './types';
import { v4 as uuid } from 'uuid';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
] as const;

export type ModelId = (typeof MODELS)[number];

export function getAvailableModels() {
  return MODELS;
}

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
}

function getMimeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/png';
}

const STYLE_PRESET_PROMPTS: Record<string, string> = {
  photorealistic: 'Professional photorealistic style with studio lighting, high detail, sharp focus, and realistic textures',
  illustration: 'Hand-drawn or digital illustration style with artistic interpretation and creative expression',
  'graphic-design': 'Modern graphic design aesthetic with clean lines, bold colors, and professional layout',
  'casual-startup': 'Relaxed and approachable style with casual vibes, friendly aesthetics, and startup energy',
  artistic: 'Creative and expressive artistic interpretation with unique style and artistic flair',
};

function buildParts(
  prompt: string,
  project: Project,
  settings: GenerationSettings,
  sourceImage?: GeneratedImage
): GeminiPart[] {
  const parts: GeminiPart[] = [];

  let fullPrompt = '';

  if (settings.stylePreset !== 'none' && STYLE_PRESET_PROMPTS[settings.stylePreset]) {
    fullPrompt += `${STYLE_PRESET_PROMPTS[settings.stylePreset]}\n\n`;
  }

  if (project.stylePrompt) {
    fullPrompt += `Style: ${project.stylePrompt}\n\n`;
  }

  if (project.description) {
    fullPrompt += `Context: ${project.description}\n\n`;
  }

  if (project.characters.length > 0) {
    fullPrompt += 'Character' + (project.characters.length > 1 ? 's' : '') + ': ';
    fullPrompt += project.characters.map(char => char.label).join(', ');
    fullPrompt += '\n\n';
  }

  fullPrompt += prompt;

  parts.push({ text: fullPrompt });

  for (const ref of project.referenceImages) {
    parts.push({
      inline_data: {
        mime_type: ref.mimeType,
        data: stripDataUrlPrefix(ref.dataUrl),
      },
    });
  }

  for (const char of project.characters) {
    parts.push({
      inline_data: {
        mime_type: char.mimeType,
        data: stripDataUrlPrefix(char.dataUrl),
      },
    });
  }

  if (sourceImage) {
    parts.push({
      inline_data: {
        mime_type: sourceImage.mimeType || getMimeFromDataUrl(sourceImage.dataUrl),
        data: stripDataUrlPrefix(sourceImage.dataUrl),
      },
    });
  }

  return parts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageFromParts(parts: any[]): { mimeType: string; data: string } | null {
  for (const part of parts) {
    // Check snake_case (inline_data) and camelCase (inlineData)
    const inlineData = part.inline_data || part.inlineData;
    if (inlineData?.data) {
      return {
        mimeType: inlineData.mime_type || inlineData.mimeType || 'image/png',
        data: inlineData.data,
      };
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromParts(parts: any[]): string {
  for (const part of parts) {
    if (typeof part.text === 'string' && part.text.length > 0) {
      return part.text;
    }
  }
  return '';
}

/**
 * Enhances a user prompt using Gemini's thinking mode and Google's best practices
 * for image generation. Returns an improved, more detailed prompt.
 */
export async function enhancePrompt(
  apiKey: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  // Use Gemini 3 Flash for fast, intelligent prompt enhancement
  const modelId = 'gemini-3-flash-002';
  const url = `${API_BASE}/${modelId}:generateContent`;

  const enhancementInstructions = `You are an expert at writing prompts for AI image generation using Google's Gemini models (Nano Banana and Nano Banana Pro).

Your task: Transform the user's basic prompt into a detailed, high-quality prompt following these best practices:

1. **Use narrative descriptions** - Write full sentences that paint a complete picture, not keyword lists
2. **Include photography terms** for realistic images: lens types (85mm portrait, wide-angle), shot angles (low angle, 45-degree elevated), lighting (golden hour, bokeh, soft diffused light), and quality terms (sharp focus, high detail, professional texture)
3. **Specify style explicitly** - Clearly state the visual style (photorealistic, illustration, graphic design, artistic, etc.)
4. **Add atmosphere and context** - Describe the mood, setting, and emotional tone
5. **Be specific about composition** - Describe foreground, background, focal points, and spatial relationships
6. **Use descriptive adjectives** - Paint a vivid picture with detailed modifiers

User's original prompt:
"""
${userPrompt}
"""

Respond with ONLY the enhanced prompt - no explanations, no meta-commentary, just the improved prompt text that can be sent directly to the image generation API.`;

  const body = {
    contents: [
      {
        parts: [{ text: enhancementInstructions }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
    // Enable thinking for Gemini 3 models
    thinkingConfig: {
      thinkingLevel: 'medium',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData?.error?.message || `Prompt enhancement failed: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Extract text from response parts (ignore thinking parts)
  const enhancedPrompt = extractTextFromParts(parts);

  if (!enhancedPrompt || enhancedPrompt.trim().length === 0) {
    throw new Error('Failed to enhance prompt - no text returned');
  }

  return enhancedPrompt.trim();
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  project: Project,
  settings: GenerationSettings,
  modelId: ModelId,
  sourceImage?: GeneratedImage,
  signal?: AbortSignal
): Promise<GeneratedImage> {
  const url = `${API_BASE}/${modelId}:generateContent`;

  const parts = buildParts(prompt, project, settings, sourceImage);

  // Build the request body — include generationConfig with responseModalities
  // to explicitly tell the model we want image output
  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: settings.temperature,
    },
  };

  console.log('[Daxer] Using model:', modelId);
  console.log('[Daxer] Request URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData?.error?.message || `API error: ${response.status} ${response.statusText}`;
    console.error('[Daxer] API error response:', JSON.stringify(errorData, null, 2));
    throw new Error(message);
  }

  const data = await response.json();

  // Comprehensive logging
  const candidate = data.candidates?.[0];
  const responseParts = candidate?.content?.parts || [];

  console.log('[Daxer] finishReason:', candidate?.finishReason);
  console.log(
    '[Daxer] Parts (' + responseParts.length + '):',
    responseParts.map((p: Record<string, unknown>) => {
      const keys = Object.keys(p);
      const info: Record<string, unknown> = { keys };
      if (p.text) info.text = (p.text as string).slice(0, 150);
      if (p.inline_data) info.hasInlineDataSnake = true;
      if (p.inlineData) info.hasInlineDataCamel = true;
      if (p.thoughtSignature) info.hasThoughtSig = true;
      if (p.thought) info.isThought = true;
      return info;
    })
  );

  // Check for blocked content
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'BLOCKED') {
    throw new Error(`Content was blocked by safety filters (${candidate.finishReason})`);
  }

  if (!candidate?.content?.parts || responseParts.length === 0) {
    console.error('[Daxer] Full response:', JSON.stringify(data).slice(0, 3000));
    throw new Error('No content returned from API. Check browser console for details.');
  }

  // Extract image from any part
  const imageResult = extractImageFromParts(responseParts);

  if (!imageResult) {
    const modelText = extractTextFromParts(responseParts);
    console.error('[Daxer] No image found in any part. Full response:', JSON.stringify(data).slice(0, 3000));
    throw new Error(
      modelText
        ? `Model responded with text instead of image: "${modelText.slice(0, 300)}"`
        : 'No image was generated. Check browser console for full API response.'
    );
  }

  return {
    id: uuid(),
    projectId: project.id,
    prompt,
    dataUrl: `data:${imageResult.mimeType};base64,${imageResult.data}`,
    mimeType: imageResult.mimeType,
    settings: { ...settings },
    createdAt: Date.now(),
    parentImageId: sourceImage?.id,
  };
}
