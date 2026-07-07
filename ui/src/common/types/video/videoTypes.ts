//! Video generation module types — mirror of backend Rust structs.

export type VideoModelInfo = {
  name: string;
  label: string;
};

export type VideoSchemaField = {
  key: string;
  fieldType: string;
  label: string;
  required: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export type VideoSchemaResponse = {
  fields: VideoSchemaField[];
  defaultValues: Record<string, unknown>;
};

export type VideoSubmitRequest = {
  model: string;
  apiKey: string;
  prompt: string;
  duration?: number;
  modelParams: Record<string, unknown>;
};

export type VideoSubmitResult = {
  taskId: string;
  requestId?: string;
};

export type VideoTaskStatus = {
  taskId: string;
  taskStatus: 'Pending' | 'Running' | 'Success' | 'Failure' | 'Expired';
  urls?: string[];
  submitTime?: number;
  finishTime?: number;
  errorMessage?: string;
  duration?: number;
  requestId?: string;
};
