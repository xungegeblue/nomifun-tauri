//! Text generation types — mirrors backend Rust structs.

export interface IChatMessage {
  role: string;
  content: string;
}

export interface ITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ITextChatRequest {
  model: string;
  apiKey: string;
  messages: IChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ITextChatResponse {
  content: string;
  model: string;
  usage?: ITokenUsage;
}

export interface ITextModelInfo {
  name: string;
  label: string;
}
