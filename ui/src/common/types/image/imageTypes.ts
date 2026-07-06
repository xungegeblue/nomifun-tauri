//! Image generation module types — mirror of backend Rust structs.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'slider'
  | 'color'
  | 'toggle'
  | 'imageList'
  | 'number';

export type SelectOption = {
  value: string;
  label: string;
};

export type SchemaField = {
  key: string;
  fieldType: FieldType;
  label: string;
  required: boolean;
  defaultValue?: unknown;
  options?: SelectOption[];
  min?: number;
  max?: number;
};

export type SchemaResponse = {
  fields: SchemaField[];
  defaultValues: Record<string, unknown>;
};

export type ModelInfo = {
  name: string;
  label: string;
};

export type GenerateParams = {
  prompt: string;
  size?: string;
  images?: string[];
  watermark?: boolean;
  stream?: boolean;
  responseFormat?: string;
  extra?: Record<string, unknown>;
};

export type GenerateResult = {
  imageUrl: string;
  model: string;
  metadata?: Record<string, unknown>;
};

export type GenerateRequest = {
  model: string;
  prompt: string;
  size?: string;
  images?: string[];
  watermark?: boolean;
  stream?: boolean;
  responseFormat?: string;
  extra?: Record<string, unknown>;
};
