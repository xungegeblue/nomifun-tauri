//! Video node placeholder component.

import React from 'react';
import { WorkflowNodeRenderer, WorkflowNodeProps } from '@flowgram.ai/free-layout-editor';
import { VideoOne } from '@icon-park/react';

const VideoNode: React.FC<WorkflowNodeProps> = ({ node }) => {
  return (
    <WorkflowNodeRenderer
      node={node}
      style={{
        width: 160,
        minHeight: 80,
        background: '#f7f8fa',
        border: '1px dashed #c9cdd4',
        borderRadius: 8,
        padding: 12,
        opacity: 0.5,
        cursor: 'not-allowed',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-4px">
        <VideoOne theme="outline" size="24" fill="#86909c" />
        <span className="text-12px text-t-secondary">即将推出</span>
      </div>
    </WorkflowNodeRenderer>
  );
};

export default VideoNode;
