//! Image list field — for 图生图 reference URLs.

import { Input, Tag } from '@arco-design/web-react';
import { IconPlus, IconClose } from '@arco-design/web-react/icon';

interface ImageListFieldProps {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}

export function ImageListField({ value, onChange, disabled }: ImageListFieldProps) {
  const handleAdd = (url: string) => {
    if (url.trim()) {
      onChange([...value, url.trim()]);
    }
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {value.map((url, i) => (
        <Tag
          key={i}
          closable={!disabled}
          onClose={() => handleRemove(i)}
          style={{ maxWidth: '100%' }}
        >
          {url.length > 50 ? url.slice(0, 50) + '...' : url}
        </Tag>
      ))}
      <Input
        suffix={<IconPlus />}
        placeholder="输入图片 URL 后回车添加"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleAdd((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
    </div>
  );
}
