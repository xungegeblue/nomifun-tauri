import type { ISchemaField } from '@/common/adapter/ipcBridge';
import { InputNumber } from '@arco-design/web-react';

interface NumberFieldProps {
  field: ISchemaField;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function NumberField({ field, value, onChange, disabled }: NumberFieldProps) {
  return (
    <InputNumber
      value={value}
      onChange={onChange}
      min={field.min}
      max={field.max}
      disabled={disabled}
    />
  );
}
