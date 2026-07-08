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

/** Default initial data for each node type (used when creating nodes). */
export const defaultNodeData: Record<string, Record<string, unknown>> = {
  [CanvasNodeType.Text]: {
    content: '',
    chatStatus: 'idle',
  } as TextNodeData,
  [CanvasNodeType.Image]: {
    generateStatus: 'idle',
  } as ImageNodeData,
  [CanvasNodeType.Video]: {},
};

/** Text node registry. */
export const textNodeRegistry: FlowNodeRegistry = {
  type: CanvasNodeType.Text,
  meta: {
    defaultPorts: [
      { type: 'output', portID: 'text-out', location: 'right' as const },
    ],
  },
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
