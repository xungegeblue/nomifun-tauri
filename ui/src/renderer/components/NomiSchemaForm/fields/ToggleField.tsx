import { Switch } from '@arco-design/web-react';

interface ToggleFieldProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function ToggleField({ value, onChange, disabled }: ToggleFieldProps) {
  return <Switch checked={value} onChange={onChange} disabled={disabled} />;
}
