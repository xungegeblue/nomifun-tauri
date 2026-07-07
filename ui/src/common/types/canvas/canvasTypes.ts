//! Canvas feature types — node data models and canvas storage types.

/** Text node data — holds prompt text and LLM config. */
export interface TextNodeData {
  content: string;
  modelConfig?: {
    model: string;
    systemPrompt?: string;
  };
  chatStatus?: 'idle' | 'generating' | 'done' | 'error';
  chatError?: string;
}

/** Image node data — holds one image and generation params. */
export interface ImageNodeData {
  image?: string; // base64 or URL
  prompt?: string;
  generateParams?: {
    size?: string;
  };
  generateStatus?: 'idle' | 'generating' | 'done' | 'error';
  generateError?: string;
}

/** Canvas data stored in localStorage. */
export interface CanvasData {
  id: string;
  name: string;
  data: Record<string, unknown>; // Flowgram toJSON() output
  createdAt: number;
  updatedAt: number;
}
