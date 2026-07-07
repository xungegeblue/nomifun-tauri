//! Canvas editor page — main editing view with Flowgram canvas, toolbar, and panels.

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Message } from '@arco-design/web-react';
import { loadCanvas, saveCanvas } from './services/canvasStorage';
import { CanvasNodeType } from './components/nodes/registries';
import FlowEditor from './components/FlowEditor';
import NodeToolbar from './components/panels/NodeToolbar';
import CanvasToolbar from './components/toolbar/CanvasToolbar';
import TextEditPanel from './components/panels/TextEditPanel';
import ImageEditPanel from './components/panels/ImageEditPanel';
import { useNodeSelection } from './components/hooks/useNodeSelection';
import type { CanvasData } from '@common/types/canvas/canvasTypes';
import type { TextNodeData } from '@common/types/canvas/canvasTypes';
import type { ImageNodeData } from '@common/types/canvas/canvasTypes';

const CanvasEditor: React.FC = () => {
  const { id: canvasId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('canvas');

  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');

  // Node selection for edit panels
  const { selection, selectNode, deselectNode } = useNodeSelection();

  // Current editing node data
  const [editingTextData, setEditingTextData] = useState<TextNodeData | null>(null);
  const [editingImageData, setEditingImageData] = useState<ImageNodeData | null>(null);

  // Load canvas data
  useEffect(() => {
    if (!canvasId) {
      navigate('/canvas');
      return;
    }

    const loaded = loadCanvas(canvasId);
    if (!loaded) {
      Message.error(t('saveFailed'));
      navigate('/canvas');
      return;
    }

    setCanvasData(loaded);
    setLoading(false);
  }, [canvasId, navigate, t]);

  // Load API key from localStorage
  useEffect(() => {
    const key = localStorage.getItem('nomifun:modelverse-api-key') || '';
    setApiKey(key);
  }, []);

  const handleBack = useCallback(() => {
    navigate('/canvas');
  }, [navigate]);

  const handleSave = useCallback(() => {
    if (!canvasData) return;
    try {
      saveCanvas({
        ...canvasData,
        updatedAt: Date.now(),
      });
      Message.success(t('saveSuccess'));
    } catch {
      Message.error(t('saveFailed'));
    }
  }, [canvasData, t]);

  const handleAddNode = useCallback(
    (type: string) => {
      // Adding nodes is handled by Flowgram's FlowOperationService
      // This is a placeholder — actual node creation will use the Flowgram API
      console.log('Add node:', type);
    },
    []
  );

  const handleNodeClick = useCallback(
    (nodeId: string, nodeType: string) => {
      selectNode(nodeId, nodeType);
    },
    [selectNode]
  );

  const handleTextDataChange = useCallback(
    (changes: Partial<TextNodeData>) => {
      if (!editingTextData) return;
      setEditingTextData((prev) => (prev ? { ...prev, ...changes } : null));
    },
    [editingTextData]
  );

  const handleImageDataChange = useCallback(
    (changes: Partial<ImageNodeData>) => {
      if (!editingImageData) return;
      setEditingImageData((prev) => (prev ? { ...prev, ...changes } : null));
    },
    [editingImageData]
  );

  const handleCreateNewImageNode = useCallback(
    (imageData: string) => {
      // This will be implemented with Flowgram's FlowOperationService
      // For now, just log it
      console.log('Create new image node with data:', imageData.slice(0, 50));
    },
    []
  );

  if (loading || !canvasData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-t-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Top toolbar */}
      <CanvasToolbar
        canvasName={canvasData.name}
        onBack={handleBack}
        onSave={handleSave}
      />

      {/* Main area: canvas + right toolbar */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Flowgram canvas */}
        <div className="flex-1 overflow-hidden">
          <FlowEditor
            canvasId={canvasData.id}
            canvasName={canvasData.name}
            initialData={canvasData.data as Record<string, unknown>}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Right node toolbar */}
        <NodeToolbar onAddNode={handleAddNode} />

        {/* Floating edit panels */}
        {selection.selectedNodeId && (
          <div
            className="absolute"
            style={{
              right: 60,
              top: 8,
              zIndex: 100,
            }}
          >
            {selection.selectedNodeType === CanvasNodeType.Text && editingTextData && (
              <TextEditPanel
                data={editingTextData}
                apiKey={apiKey}
                onChange={handleTextDataChange}
                onClose={deselectNode}
              />
            )}
            {selection.selectedNodeType === CanvasNodeType.Image && editingImageData && (
              <ImageEditPanel
                data={editingImageData}
                apiKey={apiKey}
                referenceImages={[]}
                onChange={handleImageDataChange}
                onCreateNewImageNode={handleCreateNewImageNode}
                onClose={deselectNode}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasEditor;
