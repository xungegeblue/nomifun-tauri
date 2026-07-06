import { Input } from '@arco-design/web-react';

interface TextFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function TextField({ value, onChange, disabled }: TextFieldProps) {
  return <Input value={value} onChange={onChange} disabled={disabled} />;
}
