//! Image node edit panel — floating panel for image viewing, upload, and generation.

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Input, Message } from '@arco-design/web-react';
import { UploadOne, Generate, Close, PictureOne } from '@icon-park/react';
import { generateImage, fileToBase64 } from '../../services/imageGenerateService';
import type { ImageNodeData } from '@common/types/canvas/canvasTypes';

const { TextArea } = Input;

interface ImageEditPanelProps {
  data: ImageNodeData;
  apiKey: string;
  referenceImages: string[]; // URLs/base64 from connected nodes
  onChange: (data: Partial<ImageNodeData>) => void;
  onCreateNewImageNode?: (imageData: string) => void;
  onClose: () => void;
}

const IMAGE_SIZES = [
  { label: '2K (2048×2048)', value: '2k' },
  { label: '4K', value: '4k' },
  { label: '2304×1728', value: '2304x1728' },
];

const ImageEditPanel: React.FC<ImageEditPanelProps> = ({
  data,
  apiKey,
  referenceImages,
  onChange,
  onCreateNewImageNode,
  onClose,
}) => {
  const { t } = useTranslation('canvas');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [size, setSize] = useState(data.generateParams?.size || '2k');
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePromptChange = useCallback(
    (val: string) => {
      setPrompt(val);
      onChange({ prompt: val });
    },
    [onChange]
  );

  const handleUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        Message.warning('图片大小不能超过 10MB');
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        const dataUrl = `data:${file.type};base64,${base64}`;

        if (data.image) {
          // Current node already has an image, create new node
          onCreateNewImageNode?.(dataUrl);
        } else {
          onChange({ image: dataUrl });
        }
      } catch {
        Message.error(t('errorUploading'));
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [data.image, onChange, onCreateNewImageNode, t]
  );

  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      Message.warning('请输入 API Key');
      return;
    }
    if (!prompt.trim()) {
      Message.warning(t('promptPlaceholder'));
      return;
    }

    setIsGenerating(true);
    onChange({ generateStatus: 'generating' });

    try {
      const result = await generateImage({
        model: 'doubao-seedream-4.5',
        apiKey,
        prompt,
        size,
        images: referenceImages.length > 0 ? referenceImages : undefined,
      });

      const imageUrl = result.imageUrl;

      if (data.image) {
        // Current node has image, create new node with result
        onCreateNewImageNode?.(imageUrl);
      } else {
        onChange({
          image: imageUrl,
          generateStatus: 'done',
        });
      }
    } catch (e: any) {
      onChange({
        generateStatus: 'error',
        generateError: e?.message || '生成失败',
      });
      Message.error(t('errorGenerating'));
    } finally {
      setIsGenerating(false);
    }
  }, [apiKey, prompt, size, referenceImages, data.image, onChange, onCreateNewImageNode, t]);

  return (
    <div
      className="flex flex-col gap-8px"
      style={{
        width: 380,
        maxHeight: 600,
        background: 'var(--color-bg-2)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        padding: 16,
        position: 'relative',
      }}
    >
      {/* Close button */}
      <div
        className="absolute top-8px right-8px cursor-pointer text-t-secondary hover:text-t-primary"
        onClick={onClose}
      >
        <Close theme="outline" size="16" />
      </div>

      {/* Current image preview */}
      {data.image && (
        <div
          style={{
            width: '100%',
            height: 120,
            borderRadius: 4,
            overflow: 'hidden',
            background: '#f2f3f5',
          }}
        >
          <img
            src={data.image}
            alt="current"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        size="small"
        long
        icon={<UploadOne theme="outline" size="14" />}
        onClick={handleUpload}
      >
        {t('uploadImage')}
      </Button>

      {/* Reference images */}
      {referenceImages.length > 0 && (
        <div className="flex flex-col gap-4px">
          <span className="text-12px text-t-secondary">{t('referenceImages')}</span>
          <div className="flex gap-4px flex-wrap">
            {referenceImages.map((img, i) => (
              <div
                key={i}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid var(--color-border-2)',
                }}
              >
                <img
                  src={img}
                  alt={`ref-${i}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt */}
      <TextArea
        size="small"
        placeholder={t('promptPlaceholder')}
        value={prompt}
        onChange={handlePromptChange}
        autoSize={{ minRows: 2, maxRows: 6 }}
      />

      {/* Size select */}
      <div className="flex items-center gap-8px">
        <span className="text-12px text-t-secondary shrink-0">{t('imageSize')}</span>
        <Select
          size="small"
          value={size}
          onChange={setSize}
          style={{ flex: 1 }}
        >
          {IMAGE_SIZES.map((s) => (
            <Select.Option key={s.value} value={s.value}>
              {s.label}
            </Select.Option>
          ))}
        </Select>
      </div>

      {/* Generate button */}
      <Button
        type="primary"
        size="small"
        long
        loading={isGenerating}
        icon={<Generate theme="outline" size="14" />}
        onClick={handleGenerate}
        disabled={!apiKey || isGenerating || !prompt.trim()}
      >
        {isGenerating ? t('generating') : t('generate')}
      </Button>

      {/* Error display */}
      {data.generateStatus === 'error' && data.generateError && (
        <div className="text-12px text-danger-6">{data.generateError}</div>
      )}
    </div>
  );
};

export default ImageEditPanel;
