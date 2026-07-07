//! Utility functions for getting connected node data.

import type { WorkflowNodeEntity } from '@flowgram.ai/free-layout-editor';
import { CanvasNodeType } from '../nodes/registries';
import type { ImageNodeData } from '@common/types/canvas/canvasTypes';

/** Get image URLs from all connected image nodes (both input and output). */
export function getConnectedImages(node: WorkflowNodeEntity): string[] {
  const inputNodes = (node as any).lines?.inputNodes || [];
  const outputNodes = (node as any).lines?.outputNodes || [];
  const allConnected = [...inputNodes, ...outputNodes];

  return allConnected
    .filter((n: WorkflowNodeEntity) => n.flowNodeType === CanvasNodeType.Image)
    .map((n: WorkflowNodeEntity) => {
      const data = n.getData<ImageNodeData>();
      return data?.image;
    })
    .filter(Boolean) as string[];
}

/** Get text content from connected text nodes (input only). */
export function getConnectedTexts(node: WorkflowNodeEntity): string[] {
  const inputNodes = (node as any).lines?.inputNodes || [];

  return inputNodes
    .filter((n: WorkflowNodeEntity) => n.flowNodeType === CanvasNodeType.Text)
    .map((n: WorkflowNodeEntity) => {
      const data = n.getData<{ content: string }>();
      return data?.content;
    })
    .filter(Boolean) as string[];
}
