import { Input } from '@arco-design/web-react';

interface ColorFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function ColorField({ value, onChange, disabled }: ColorFieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: 32, height: 32, border: '1px solid var(--border-1)', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <Input value={value} onChange={onChange} disabled={disabled} style={{ width: 120 }} />
    </div>
  );
}
