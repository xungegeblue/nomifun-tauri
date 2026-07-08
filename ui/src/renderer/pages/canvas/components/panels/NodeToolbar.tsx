//! Right-side node toolbar — buttons to add text, image, video nodes.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { Edit, PictureOne, VideoOne } from '@icon-park/react';
import { CanvasNodeType } from '../nodes/registries';

interface NodeToolbarProps {
  onAddNode?: (type: string) => void;
}

const NodeToolbar: React.FC<NodeToolbarProps> = ({ onAddNode }) => {
  const { t } = useTranslation('canvas');

  const handleAdd = (type: string) => {
    onAddNode?.(type);
  };

  return (
    <div
      className="flex flex-col items-center gap-8px py-8px px-4px rd-8px"
      style={{
        background: 'var(--color-bg-2)',
        border: '1px solid var(--color-border-2)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <Tooltip content={t('nodeText')} position="left">
        <div
          className="w-36px h-36px flex items-center justify-center rd-8px cursor-pointer transition-colors hover:bg-fill-2 active:bg-fill-3"
          onClick={() => handleAdd(CanvasNodeType.Text)}
        >
          <Edit theme="outline" size="18" fill="currentColor" />
        </div>
      </Tooltip>

      <Tooltip content={t('nodeImage')} position="left">
        <div
          className="w-36px h-36px flex items-center justify-center rd-8px cursor-pointer transition-colors hover:bg-fill-2 active:bg-fill-3"
          onClick={() => handleAdd(CanvasNodeType.Image)}
        >
          <PictureOne theme="outline" size="18" fill="currentColor" />
        </div>
      </Tooltip>

      <Tooltip content={t('nodeVideo')} position="left">
        <div
          className="w-36px h-36px flex items-center justify-center rd-8px cursor-not-allowed opacity-40"
        >
          <VideoOne theme="outline" size="18" fill="currentColor" />
        </div>
      </Tooltip>
    </div>
  );
};

export default NodeToolbar;
