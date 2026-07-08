//! Editor configuration hook — assembles all Flowgram FreeLayout props.

import { useMemo } from 'react';
import type { FreeLayoutProps } from '@flowgram.ai/free-layout-editor';
import { nodeRegistries, CanvasNodeType } from '../nodes/registries';
import TextNode from '../nodes/TextNode';
import ImageNode from '../nodes/ImageNode';
import VideoNode from '../nodes/VideoNode';
import { saveCanvas } from '../../services/canvasStorage';
import type { CanvasData } from '@common/types/canvas/canvasTypes';

interface UseEditorPropsOptions {
  canvasId: string;
  canvasName: string;
  initialData: Record<string, unknown>;
}

export function useEditorProps({
  canvasId,
  canvasName,
  initialData,
}: UseEditorPropsOptions): FreeLayoutProps {
  return useMemo(
    () => ({
      background: true,
      readonly: false,
      twoWayConnection: true,
      enableReadonlyNodeDragging: false,

      initialData: initialData as any,
      nodeRegistries,

      materials: {
        renderDefaultNode: (props: any) => {
          const nodeType = props.node?.flowNodeType;
          switch (nodeType) {
            case CanvasNodeType.Text:
              return <TextNode {...props} />;
            case CanvasNodeType.Image:
              return <ImageNode {...props} />;
            case CanvasNodeType.Video:
              return <VideoNode {...props} />;
            default:
              return <TextNode {...props} />;
          }
        },
      },

      nodeEngine: { enable: true },
      variableEngine: { enable: true },
      history: { enable: true, enableChangeNode: true },

      scroll: { enableScrollLimit: false },

      canAddLine: (_ctx: any, fromPort: any, toPort: any) => {
        // Prevent self-loops
        if (fromPort.node.id === toPort.node.id) return false;
        return true;
      },

      canDeleteLine: () => true,
      canDeleteNode: () => true,
      canResetLine: () => true,

      onContentChange: (ctx: any) => {
        // Debounced auto-save handled by the parent component
        // This callback fires on every change, parent should debounce
        try {
          const json = ctx.document.toJSON();
          saveCanvas({
            id: canvasId,
            name: canvasName,
            data: json,
            createdAt: 0, // preserve existing
            updatedAt: Date.now(),
          } as CanvasData);
        } catch (e) {
          console.error('Auto-save failed:', e);
        }
      },

      onAllLayersRendered: (ctx: any) => {
        try {
          ctx.tools?.fitView?.(false);
        } catch {
          // ignore
        }
      },

      plugins: () => [],
    }),
    [canvasId, canvasName, initialData]
  );
}
