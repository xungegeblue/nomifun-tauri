//! Canvas list page — displays all saved canvases, create/delete.

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Input, Message, Empty } from '@arco-design/web-react';
import { Plus, Delete, GridFour } from '@icon-park/react';
import { listCanvases, deleteCanvas, saveCanvas, generateCanvasId } from './services/canvasStorage';
import type { CanvasData } from '@common/types/canvas/canvasTypes';

const CanvasListPage: React.FC = () => {
  const { t } = useTranslation('canvas');
  const navigate = useNavigate();
  const [canvases, setCanvases] = useState<CanvasData[]>(() => listCanvases());
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const refreshList = useCallback(() => {
    setCanvases(listCanvases());
  }, []);

  const handleCreate = useCallback(() => {
    const name = newName.trim() || t('canvasTitle');
    const id = generateCanvasId();
    const now = Date.now();

    saveCanvas({
      id,
      name,
      data: { nodes: [], edges: [] },
      createdAt: now,
      updatedAt: now,
    });

    setNewName('');
    setShowCreate(false);
    navigate(`/canvas/${id}`);
  }, [newName, t, navigate]);

  const handleDelete = useCallback(
    (canvas: CanvasData) => {
      Modal.confirm({
        title: t('deleteConfirm', { name: canvas.name }),
        onOk: () => {
          deleteCanvas(canvas.id);
          refreshList();
          Message.success(t('saveSuccess'));
        },
      });
    },
    [t, refreshList]
  );

  const handleOpen = useCallback(
    (canvasId: string) => {
      navigate(`/canvas/${canvasId}`);
    },
    [navigate]
  );

  return (
    <div className="p-24px h-full overflow-auto">
      <div className="flex items-center justify-between mb-16px">
        <h2 className="text-20px font-600 text-t-primary m-0">{t('title')}</h2>
        <Button
          type="primary"
          icon={<Plus theme="outline" size="16" />}
          onClick={() => setShowCreate(true)}
        >
          {t('newCanvas')}
        </Button>
      </div>

      {canvases.length === 0 ? (
        <Empty description={t('emptyState')} />
      ) : (
        <div className="grid gap-16px" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {canvases.map((canvas) => (
            <Card
              key={canvas.id}
              hoverable
              className="cursor-pointer"
              style={{ borderRadius: 8 }}
              onClick={() => handleOpen(canvas.id)}
            >
              <div className="flex items-start gap-8px">
                <GridFour theme="outline" size="20" fill="#1677ff" className="shrink-0 mt-2px" />
                <div className="flex-1 min-w-0">
                  <div className="text-14px font-500 text-t-primary truncate">
                    {canvas.name}
                  </div>
                  <div className="text-12px text-t-secondary mt-4px">
                    {new Date(canvas.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className="shrink-0 cursor-pointer text-t-secondary hover:text-danger-6 p-4px"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(canvas);
                  }}
                >
                  <Delete theme="outline" size="16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        title={t('newCanvas')}
        visible={showCreate}
        onOk={handleCreate}
        onCancel={() => setShowCreate(false)}
        simple
      >
        <Input
          placeholder={t('canvasNamePlaceholder')}
          value={newName}
          onChange={setNewName}
          onPressEnter={handleCreate}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default CanvasListPage;
