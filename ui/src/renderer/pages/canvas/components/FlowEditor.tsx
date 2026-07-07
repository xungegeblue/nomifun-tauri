//! FlowEditor — wraps Flowgram FreeLayoutEditorProvider + EditorRenderer.

import React from 'react';
import { FreeLayoutEditorProvider, EditorRenderer } from '@flowgram.ai/free-layout-editor';
import '@flowgram.ai/free-layout-editor/index.css';
import { useEditorProps } from './hooks/useEditorProps';
import type { CanvasData } from '@common/types/canvas/canvasTypes';

interface FlowEditorProps {
  canvasId: string;
  canvasName: string;
  initialData: Record<string, unknown>;
  onNodeClick?: (nodeId: string, nodeType: string) => void;
}

const FlowEditor: React.FC<FlowEditorProps> = ({
  canvasId,
  canvasName,
  initialData,
  onNodeClick,
}) => {
  const editorProps = useEditorProps({
    canvasId,
    canvasName,
    initialData,
    onNodeClick,
  });

  return (
    <div className="w-full h-full">
      <FreeLayoutEditorProvider {...editorProps}>
        <EditorRenderer className="w-full h-full" />
      </FreeLayoutEditorProvider>
    </div>
  );
};

export default FlowEditor;
