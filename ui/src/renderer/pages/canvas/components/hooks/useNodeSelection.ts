//! Node selection and edit panel state management.

import { useState, useCallback } from 'react';

export interface NodeSelectionState {
  selectedNodeId: string | null;
  selectedNodeType: string | null;
  panelPosition: { x: number; y: number } | null;
}

export function useNodeSelection() {
  const [selection, setSelection] = useState<NodeSelectionState>({
    selectedNodeId: null,
    selectedNodeType: null,
    panelPosition: null,
  });

  const selectNode = useCallback(
    (nodeId: string, nodeType: string, position?: { x: number; y: number }) => {
      setSelection({
        selectedNodeId: nodeId,
        selectedNodeType: nodeType,
        panelPosition: position || null,
      });
    },
    []
  );

  const deselectNode = useCallback(() => {
    setSelection({
      selectedNodeId: null,
      selectedNodeType: null,
      panelPosition: null,
    });
  }, []);

  return {
    selection,
    selectNode,
    deselectNode,
    isSelected: selection.selectedNodeId !== null,
  };
}
