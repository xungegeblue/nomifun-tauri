import type { ISchemaField } from '@/common/adapter/ipcBridge';
import { Slider } from '@arco-design/web-react';

interface SliderFieldProps {
  field: ISchemaField;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function SliderField({ field, value, onChange, disabled }: SliderFieldProps) {
  return (
    <Slider
      value={value}
      onChange={onChange as (v: number | number[]) => void}
      min={field.min ?? 0}
      max={field.max ?? 100}
      disabled={disabled}
    />
  );
}
