import type { ISchemaField } from '@/common/adapter/ipcBridge';
import { Select } from '@arco-design/web-react';

interface SelectFieldProps {
  field: ISchemaField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function SelectField({ field, value, onChange, disabled }: SelectFieldProps) {
  const options = field.options ?? [];
  return (
    <Select value={value} onChange={onChange} disabled={disabled} placeholder={`请选择${field.label}`}>
      {options.map((opt) => (
        <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
      ))}
    </Select>
  );
}
