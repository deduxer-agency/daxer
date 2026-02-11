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

function buildParts(
  prompt: string,
  project: Project,
  sourceImage?: GeneratedImage
): GeminiPart[] {
  const parts: GeminiPart[] = [];

  let fullPrompt = '';

  if (project.stylePrompt) {
    fullPrompt += `Style: ${project.stylePrompt}\n\n`;
  }

  if (project.description) {
    fullPrompt += `Context: ${project.description}\n\n`;
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

  const parts = buildParts(prompt, project, sourceImage);

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
