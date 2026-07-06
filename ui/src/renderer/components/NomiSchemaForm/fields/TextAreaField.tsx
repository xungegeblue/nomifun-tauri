import { Input } from '@arco-design/web-react';

interface TextAreaFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function TextAreaField({ value, onChange, disabled }: TextAreaFieldProps) {
  return <Input.TextArea value={value} onChange={onChange} disabled={disabled} autoSize={{ minRows: 2, maxRows: 6 }} />;
}
