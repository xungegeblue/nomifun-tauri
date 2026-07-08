//! FlowEditor — wraps Flowgram FreeLayoutEditorProvider + EditorRenderer with data-flow bridge.

import React, { useEffect, useCallback } from 'react';
import {
  FreeLayoutEditorProvider,
  EditorRenderer,
  usePlaygroundContext,
  useService,
  WorkflowDocument,
  WorkflowSelectService,
} from '@flowgram.ai/free-layout-editor';
import { useEditorProps } from './hooks/useEditorProps';
import { getConnectedImages, getConnectedTexts } from './shared/ConnectedImages';
import NodeToolbar from './panels/NodeToolbar';
import { defaultNodeData } from './nodes/registries';

/** Rich node-select payload: node id, type, + connected upstream data. */
export interface NodeSelectPayload {
  nodeId: string;
  nodeType: string;
  /** All connected input-node images (ImageNode.image). */
  connectedImages: string[];
  /** All connected input-node text content (TextNode.content). */
  connectedTexts: string[];
  /** Raw node entity for direct data read/write. */
  node: any;
}

interface FlowEditorProps {
  canvasId: string;
  canvasName: string;
  initialData: Record<string, unknown>;
  /** Called when a node is clicked/selected, with full context. */
  onNodeSelect?: (payload: NodeSelectPayload) => void;
  /** Ref to access the Flowgram playground (graph, selectionService, etc). */
  playgroundRef?: React.MutableRefObject<any>;
}

/* ------------------------------------------------------------------ */
/*  Inner component — lives inside FreeLayoutEditorProvider            */
/* ------------------------------------------------------------------ */

const FlowEditorInner: React.FC<{
  playgroundRef?: React.MutableRefObject<any>;
  onNodeSelect?: (payload: NodeSelectPayload) => void;
}> = ({ playgroundRef, onNodeSelect }) => {
  const playground = usePlaygroundContext();
  const document = useService(WorkflowDocument);
  const selectService = useService(WorkflowSelectService);

  // Expose playground to parent
  useEffect(() => {
    if (playgroundRef) {
      playgroundRef.current = playground;
    }
  }, [playground, playgroundRef]);

  // Monitor Flowgram selection changes
  useEffect(() => {
    if (!playground) return;

    const selectionService = (playground as any).selectionService;
    if (!selectionService) return;

    const handleSelectionChange = () => {
      if (!onNodeSelect) return;

      const selectedIds: string[] =
        selectionService.getSelectedNodeIds?.() ?? [];

      if (selectedIds.length === 0) {
        // Deselection — fire with empty payload so parent can close panels
        onNodeSelect({
          nodeId: '',
          nodeType: '',
          connectedImages: [],
          connectedTexts: [],
          node: null,
        });
        return;
      }

      const nodeId = selectedIds[0];
      const graph = (playground as any).graph;
      const node = graph?.getNode?.(nodeId);

      if (node) {
        const nodeType = node.flowNodeType || 'default';
        const connectedImages = getConnectedImages(node);
        const connectedTexts = getConnectedTexts(node);

        onNodeSelect({
          nodeId,
          nodeType,
          connectedImages,
          connectedTexts,
          node,
        });
      }
    };

    // Subscribe — try common API patterns
    const unsubscribe =
      typeof selectionService.onSelectionChange === 'function'
        ? selectionService.onSelectionChange(handleSelectionChange)
        : undefined;

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [playground, onNodeSelect]);

  // ---- Node creation via WorkflowDocument ----
  // createWorkflowNodeByType: creates a node by type, auto-positions at viewport center
  const handleAddNode = useCallback(
    (type: string) => {
      if (!document) return;
      const data = defaultNodeData[type] || {};
      // position is omitted → node is placed at the canvas viewport center automatically
      const node = document.createWorkflowNodeByType(type, undefined, { data } as any);
      // Auto-select the newly created node
      if (node && selectService) {
        selectService.selectNode(node);
      }
    },
    [document, selectService]
  );

  return (
    <>
      <EditorRenderer className="w-full h-full" />
      {/* Right-side node toolbar — floating overlay inside Provider */}
      <div
        className="absolute"
        style={{
          right: 8,
          top: 8,
          zIndex: 90,
        }}
      >
        <NodeToolbar onAddNode={handleAddNode} />
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Public component                                                   */
/* ------------------------------------------------------------------ */

const FlowEditor: React.FC<FlowEditorProps> = ({
  canvasId,
  canvasName,
  initialData,
  onNodeSelect,
  playgroundRef,
}) => {
  const editorProps = useEditorProps({
    canvasId,
    canvasName,
    initialData,
  });

  return (
    <div className="w-full h-full relative">
      <FreeLayoutEditorProvider {...editorProps}>
        <FlowEditorInner
          playgroundRef={playgroundRef}
          onNodeSelect={onNodeSelect}
        />
      </FreeLayoutEditorProvider>
    </div>
  );
};

export default FlowEditor;
