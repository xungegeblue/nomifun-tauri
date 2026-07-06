//! Schema-driven dynamic form — renders any model×scenario parameter schema.

import type { ISchemaField } from '@/common/adapter/ipcBridge';
import { SchemaFieldRenderer } from './SchemaFieldRenderer';
import styles from './NomiSchemaForm.module.css';

interface NomiSchemaFormProps {
  schema: ISchemaField[];
  defaults?: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function NomiSchemaForm({
  schema,
  defaults = {},
  values,
  onChange,
  disabled = false,
}: NomiSchemaFormProps) {
  const merged = { ...defaults, ...values };

  const handleChange = (key: string, value: unknown) => {
    onChange({ ...merged, [key]: value });
  };

  return (
    <div className={styles.form}>
      {schema.map((field) => (
        <div key={field.key} className={styles.field}>
          <label className={styles.label}>
            {field.label}
            {field.required && <span className={styles.required}>*</span>}
          </label>
          <SchemaFieldRenderer
            field={field}
            value={merged[field.key]}
            onChange={(v) => handleChange(field.key, v)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}
