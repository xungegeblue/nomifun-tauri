//! Text node rendering component — shows text summary on the canvas.

import React from 'react';
import { useNodeRender, WorkflowNodeRenderer, WorkflowNodeProps } from '@flowgram.ai/free-layout-editor';
import { Edit } from '@icon-park/react';
import type { TextNodeData } from '@common/types/canvas/canvasTypes';

const TRUNCATE_LENGTH = 50;

const TextNode: React.FC<WorkflowNodeProps> = ({ node }) => {
  const { selected } = useNodeRender();
  const data = node.getData<TextNodeData>() || { content: '' };
  const isGenerating = data.chatStatus === 'generating';

  const displayText = data.content
    ? data.content.length > TRUNCATE_LENGTH
      ? data.content.slice(0, TRUNCATE_LENGTH) + '...'
      : data.content
    : '空文本节点';

  return (
    <WorkflowNodeRenderer
      node={node}
      style={{
        width: 200,
        minHeight: 60,
        background: selected ? '#e8f4fd' : '#fff',
        border: selected ? '2px solid #1677ff' : '1px solid #e5e6eb',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: 12,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <div className="flex items-start gap-8px">
        <Edit
          theme="outline"
          size="16"
          fill={isGenerating ? '#1677ff' : '#86909c'}
          className="shrink-0 mt-2px"
        />
        <div className="flex-1 min-w-0">
          <div className="text-13px text-t-primary leading-18px break-words">
            {displayText}
          </div>
          {isGenerating && (
            <div className="text-11px text-primary-6 mt-4px">
              生成中...
            </div>
          )}
        </div>
      </div>
    </WorkflowNodeRenderer>
  );
};

export default TextNode;
