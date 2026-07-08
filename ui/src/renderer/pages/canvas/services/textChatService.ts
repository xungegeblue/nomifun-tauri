//! Text chat service — wraps backend API calls.

import { text } from '@common/adapter/ipcBridge';
import type { ITextChatRequest, ITextChatResponse, ITextModelInfo, IChatMessage } from '@common/adapter/ipcBridge';

export interface GeneratePromptParams {
  model: string;
  apiKey: string;
  messages: IChatMessage[];
  systemPrompt?: string;
  temperature?: number;
}

export async function generatePrompt(params: GeneratePromptParams): Promise<ITextChatResponse> {
  const messages = [...params.messages];
  // If systemPrompt provided, prepend as system message
  if (params.systemPrompt) {
    messages.unshift({ role: 'system', content: params.systemPrompt });
  }

  const request: ITextChatRequest = {
    model: params.model,
    apiKey: params.apiKey,
    messages,
    stream: false,
    temperature: params.temperature,
  };
  return text.chat(request);
}

export async function listTextModels(): Promise<ITextModelInfo[]> {
  return text.listModels();
}
