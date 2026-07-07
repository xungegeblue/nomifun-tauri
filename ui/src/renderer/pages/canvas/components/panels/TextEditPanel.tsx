//! Text node edit panel — floating panel for editing text and generating prompts.

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Button, Select, Message } from '@arco-design/web-react';
import { Generate, Close } from '@icon-park/react';
import { generatePrompt, listTextModels } from '../../services/textChatService';
import type { TextNodeData } from '@common/types/canvas/canvasTypes';
import type { ITextModelInfo } from '@common/adapter/ipcBridge';

const { TextArea } = Input;

interface TextEditPanelProps {
  data: TextNodeData;
  apiKey: string;
  onChange: (data: Partial<TextNodeData>) => void;
  onClose: () => void;
}

const TextEditPanel: React.FC<TextEditPanelProps> = ({
  data,
  apiKey,
  onChange,
  onClose,
}) => {
  const { t } = useTranslation('canvas');
  const [content, setContent] = useState(data.content || '');
  const [systemPrompt, setSystemPrompt] = useState(data.modelConfig?.systemPrompt || '');
  const [selectedModel, setSelectedModel] = useState(data.modelConfig?.model || '');
  const [models, setModels] = useState<ITextModelInfo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load models on first render
  React.useEffect(() => {
    listTextModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  const handleContentChange = useCallback(
    (val: string) => {
      setContent(val);
      onChange({ content: val });
    },
    [onChange]
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedModel || !apiKey) {
      Message.warning('请选择模型并输入 API Key');
      return;
    }
    if (!content.trim()) {
      Message.warning('请输入需求描述');
      return;
    }

    setIsGenerating(true);
    onChange({ chatStatus: 'generating' });

    try {
      const result = await generatePrompt({
        model: selectedModel,
        apiKey,
        messages: [{ role: 'user', content }],
        systemPrompt: systemPrompt || undefined,
      });
      setContent(result.content);
      onChange({
        content: result.content,
        chatStatus: 'done',
        modelConfig: { model: selectedModel, systemPrompt },
      });
    } catch (e: any) {
      onChange({ chatStatus: 'error', chatError: e?.message || '生成失败' });
      Message.error(t('errorGenerating'));
    } finally {
      setIsGenerating(false);
    }
  }, [selectedModel, apiKey, content, systemPrompt, onChange, t]);

  return (
    <div
      className="flex flex-col gap-8px"
      style={{
        width: 360,
        maxHeight: 500,
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

      {/* Model select */}
      <div className="flex items-center gap-8px">
        <span className="text-12px text-t-secondary shrink-0">{t('modelSelect')}</span>
        <Select
          size="small"
          placeholder={t('modelSelect')}
          value={selectedModel || undefined}
          onChange={setSelectedModel}
          style={{ flex: 1 }}
        >
          {models.map((m) => (
            <Select.Option key={m.name} value={m.name}>
              {m.label}
            </Select.Option>
          ))}
        </Select>
      </div>

      {/* System prompt */}
      <Input
        size="small"
        placeholder={t('systemPromptPlaceholder')}
        value={systemPrompt}
        onChange={setSystemPrompt}
      />

      {/* Content textarea */}
      <TextArea
        size="small"
        placeholder={t('promptPlaceholder')}
        value={content}
        onChange={handleContentChange}
        autoSize={{ minRows: 4, maxRows: 10 }}
        style={{ flex: 1 }}
      />

      {/* Generate button */}
      <Button
        type="primary"
        size="small"
        long
        loading={isGenerating}
        icon={<Generate theme="outline" size="14" />}
        onClick={handleGenerate}
        disabled={!selectedModel || !apiKey || isGenerating}
      >
        {isGenerating ? t('generating') : t('generatePrompt')}
      </Button>
    </div>
  );
};

export default TextEditPanel;
