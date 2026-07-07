//! Top canvas toolbar — back, name, save, zoom controls.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from '@arco-design/web-react';
import { Left, Save, ZoomIn, ZoomOut, FullScreen } from '@icon-park/react';

interface CanvasToolbarProps {
  canvasName: string;
  onBack: () => void;
  onSave: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  canvasName,
  onBack,
  onSave,
  onZoomIn,
  onZoomOut,
  onFitView,
}) => {
  const { t } = useTranslation('canvas');

  return (
    <div
      className="flex items-center gap-8px px-12px h-40px shrink-0"
      style={{
        background: 'var(--color-bg-2)',
        borderBottom: '1px solid var(--color-border-2)',
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<Left theme="outline" size="16" />}
        onClick={onBack}
      />

      <Typography.Text
        className="flex-1 text-14px font-500 truncate"
        style={{ maxWidth: 200 }}
      >
        {canvasName}
      </Typography.Text>

      <div className="flex items-center gap-4px ml-auto">
        <Button
          type="text"
          size="mini"
          icon={<ZoomOut theme="outline" size="16" />}
          onClick={onZoomOut}
        />
        <Button
          type="text"
          size="mini"
          icon={<ZoomIn theme="outline" size="16" />}
          onClick={onZoomIn}
        />
        <Button
          type="text"
          size="mini"
          icon={<FullScreen theme="outline" size="16" />}
          onClick={onFitView}
        />
        <Button
          type="text"
          size="small"
          icon={<Save theme="outline" size="16" />}
          onClick={onSave}
        >
          {t('save')}
        </Button>
      </div>
    </div>
  );
};

export default CanvasToolbar;
