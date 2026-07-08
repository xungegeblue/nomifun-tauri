//! Image generation service — wraps backend API calls.

import { image } from '@common/adapter/ipcBridge';
import type { IGenerateRequest, IGenerateResult } from '@common/adapter/ipcBridge';

export interface GenerateImageParams {
  model: string;
  apiKey: string;
  prompt: string;
  size?: string;
  images?: string[];
}

export async function generateImage(params: GenerateImageParams): Promise<IGenerateResult> {
  const request: IGenerateRequest = {
    model: params.model,
    apiKey: params.apiKey,
    prompt: params.prompt,
    size: params.size,
    images: params.images,
  };
  return image.generate(request);
}

export async function listImageModels() {
  return image.listModels();
}

export async function getImageSchema(model: string) {
  return image.getSchema({ model });
}

/** Convert a File object to base64 string. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. "data:image/png;base64,")
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
