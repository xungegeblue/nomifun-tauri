//! Image node rendering component — shows image thumbnail or placeholder on the canvas.

import React from 'react';
import { useNodeRender, WorkflowNodeRenderer, WorkflowNodeProps } from '@flowgram.ai/free-layout-editor';
import { PictureOne, LoadingFour } from '@icon-park/react';
import type { ImageNodeData } from '@common/types/canvas/canvasTypes';

const ImageNode: React.FC<WorkflowNodeProps> = ({ node }) => {
  const { selected } = useNodeRender();
  const data = node.getData<ImageNodeData>() || {};
  const isGenerating = data.generateStatus === 'generating';
  const hasError = data.generateStatus === 'error';

  return (
    <WorkflowNodeRenderer
      node={node}
      style={{
        width: 160,
        minHeight: data.image ? 180 : 80,
        background: hasError ? '#fff2f0' : selected ? '#e8f4fd' : '#fff',
        border: hasError
          ? '2px solid #f53f3f'
          : selected
            ? '2px solid #1677ff'
            : '1px solid #e5e6eb',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: 8,
        cursor: 'pointer',
        transition: 'all 0.2s',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {data.image ? (
        <div className="relative">
          <img
            src={data.image.startsWith('data:') ? data.image : data.image}
            alt="node image"
            style={{
              width: '100%',
              height: 140,
              objectFit: 'cover',
              borderRadius: 4,
              display: 'block',
            }}
          />
          {isGenerating && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.7)',
                borderRadius: 4,
              }}
            >
              <LoadingFour theme="outline" size="24" fill="#1677ff" className="animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4px py-12px">
          {isGenerating ? (
            <LoadingFour theme="outline" size="24" fill="#1677ff" className="animate-spin" />
          ) : (
            <PictureOne theme="outline" size="24" fill="#86909c" />
          )}
          <span className="text-12px text-t-secondary">
            {isGenerating ? '生成中...' : hasError ? '生成失败' : '上传图片'}
          </span>
        </div>
      )}
      {data.prompt && !data.image && (
        <div className="text-11px text-t-secondary px-4px pb-4px truncate">
          {data.prompt}
        </div>
      )}
    </WorkflowNodeRenderer>
  );
};

export default ImageNode;
