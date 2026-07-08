//! Canvas editor page — main editing view with Flowgram canvas, toolbar, and panels.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Message } from '@arco-design/web-react';
import { loadCanvas, saveCanvas } from './services/canvasStorage';
import { CanvasNodeType } from './components/nodes/registries';
import FlowEditor from './components/FlowEditor';
import type { NodeSelectPayload } from './components/FlowEditor';
import CanvasToolbar from './components/toolbar/CanvasToolbar';
import TextEditPanel from './components/panels/TextEditPanel';
import ImageEditPanel from './components/panels/ImageEditPanel';
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

  // Flowgram playground ref — for reading/writing node data
  const playgroundRef = useRef<any>(null);

  // Current selection state (from Flowgram)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(null);

  // Edit panel data (synced with Flowgram nodes)
  const [editingTextData, setEditingTextData] = useState<TextNodeData | null>(null);
  const [editingImageData, setEditingImageData] = useState<ImageNodeData | null>(null);

  // Connected upstream data for the selected node
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceTexts, setReferenceTexts] = useState<string[]>([]);

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

  // ---- Node selection handler (flows from Flowgram) ----

  const handleNodeSelect = useCallback((payload: NodeSelectPayload) => {
    // Deselection
    if (!payload.nodeId || !payload.node) {
      setSelectedNodeId(null);
      setSelectedNodeType(null);
      setEditingTextData(null);
      setEditingImageData(null);
      setReferenceImages([]);
      setReferenceTexts([]);
      return;
    }

    const { nodeId, nodeType, connectedImages, connectedTexts, node } = payload;

    setSelectedNodeId(nodeId);
    setSelectedNodeType(nodeType);
    setReferenceImages(connectedImages);
    setReferenceTexts(connectedTexts);

    // Read actual node data from Flowgram and seed edit panel
    const data = (node as any).getData?.();
    if (nodeType === CanvasNodeType.Text) {
      // Pre-fill prompt from connected text nodes if content is empty
      const initialData = (data || {}) as TextNodeData;
      if (!initialData.content && connectedTexts.length > 0) {
        initialData.content = connectedTexts.join('\n');
      }
      setEditingTextData(initialData);
    } else if (nodeType === CanvasNodeType.Image) {
      const initialData = (data || {}) as ImageNodeData;
      // Pre-fill prompt from connected text nodes
      if (!initialData.prompt && connectedTexts.length > 0) {
        initialData.prompt = connectedTexts.join('\n');
      }
      setEditingImageData(initialData);
    } else {
      setEditingTextData(null);
      setEditingImageData(null);
    }
  }, []);

  // ---- Data change handlers (sync back to Flowgram) ----

  const handleTextDataChange = useCallback(
    (changes: Partial<TextNodeData>) => {
      setEditingTextData((prev) => (prev ? { ...prev, ...changes } : null));

      // Sync back to Flowgram node
      const playground = playgroundRef.current;
      if (playground && selectedNodeId) {
        const node = playground.graph?.getNode?.(selectedNodeId);
        if (node) {
          const currentData = (node as any).getData?.() || {};
          (node as any).setData?.({ ...currentData, ...changes });
        }
      }
    },
    [selectedNodeId]
  );

  const handleImageDataChange = useCallback(
    (changes: Partial<ImageNodeData>) => {
      setEditingImageData((prev) => (prev ? { ...prev, ...changes } : null));

      // Sync back to Flowgram node
      const playground = playgroundRef.current;
      if (playground && selectedNodeId) {
        const node = playground.graph?.getNode?.(selectedNodeId);
        if (node) {
          const currentData = (node as any).getData?.() || {};
          (node as any).setData?.({ ...currentData, ...changes });
        }
      }
    },
    [selectedNodeId]
  );

  const handleDeselectNode = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(null);
    setEditingTextData(null);
    setEditingImageData(null);
    setReferenceImages([]);
    setReferenceTexts([]);

    // Also clear Flowgram selection
    const playground = playgroundRef.current;
    if (playground) {
      playground.selectionService?.clearSelection?.();
    }
  }, []);

  const handleCreateNewImageNode = useCallback(
    (imageData: string) => {
      // This will be implemented with Flowgram's FlowOperationService
      console.log('Create new image node with data:', imageData.slice(0, 50));
    },
    []
  );

  const hasSelection = selectedNodeId !== null;

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

      {/* Main area: canvas + right panels */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Flowgram canvas — NodeToolbar is now rendered inside FlowEditor (within FreeLayoutEditorProvider) */}
        <div className="flex-1 overflow-hidden">
          <FlowEditor
            canvasId={canvasData.id}
            canvasName={canvasData.name}
            initialData={canvasData.data as Record<string, unknown>}
            onNodeSelect={handleNodeSelect}
            playgroundRef={playgroundRef}
          />
        </div>

        {/* Floating edit panels */}
        {hasSelection && (
          <div
            className="absolute"
            style={{
              right: 68,
              top: 8,
              zIndex: 100,
            }}
          >
            {selectedNodeType === CanvasNodeType.Text && editingTextData && (
              <TextEditPanel
                data={editingTextData}
                apiKey={apiKey}
                onChange={handleTextDataChange}
                onClose={handleDeselectNode}
              />
            )}
            {selectedNodeType === CanvasNodeType.Image && editingImageData && (
              <ImageEditPanel
                data={editingImageData}
                apiKey={apiKey}
                referenceImages={referenceImages}
                onChange={handleImageDataChange}
                onCreateNewImageNode={handleCreateNewImageNode}
                onClose={handleDeselectNode}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasEditor;
