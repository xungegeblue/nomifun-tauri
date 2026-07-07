//! Node type constants and registry definitions for the canvas.

import type { FlowNodeRegistry } from '@flowgram.ai/free-layout-editor';
import type { TextNodeData } from '@common/types/canvas/canvasTypes';
import type { ImageNodeData } from '@common/types/canvas/canvasTypes';

/** Node type identifiers. */
export const CanvasNodeType = {
  Text: 'text',
  Image: 'image',
  Video: 'video',
} as const;

/** Text node registry. */
export const textNodeRegistry: FlowNodeRegistry = {
  type: CanvasNodeType.Text,
  meta: {
    defaultPorts: [
      { type: 'output', portID: 'text-out', location: 'right' as const },
    ],
  },
  onAdd: () => ({
    id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: CanvasNodeType.Text,
    data: {
      content: '',
      chatStatus: 'idle',
    } as TextNodeData,
    meta: { position: { x: 300, y: 200 } },
  }),
};

/** Image node registry. */
export const imageNodeRegistry: FlowNodeRegistry = {
  type: CanvasNodeType.Image,
  meta: {
    defaultPorts: [
      { type: 'input', portID: 'image-in', location: 'left' as const },
      { type: 'output', portID: 'image-out', location: 'right' as const },
    ],
  },
  onAdd: () => ({
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: CanvasNodeType.Image,
    data: {
      generateStatus: 'idle',
    } as ImageNodeData,
    meta: { position: { x: 300, y: 200 } },
  }),
};

/** Video node registry (placeholder). */
export const videoNodeRegistry: FlowNodeRegistry = {
  type: CanvasNodeType.Video,
  meta: {
    deleteDisable: true,
    defaultPorts: [],
  },
};

/** All node registries. */
export const nodeRegistries: FlowNodeRegistry[] = [
  textNodeRegistry,
  imageNodeRegistry,
  videoNodeRegistry,
];
