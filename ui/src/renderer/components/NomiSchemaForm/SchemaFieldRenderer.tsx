//! Routes schema field type → corresponding UI component.

import type { ISchemaField } from '@/common/adapter/ipcBridge';
import { TextAreaField } from './fields/TextAreaField';
import { TextField } from './fields/TextField';
import { SelectField } from './fields/SelectField';
import { SliderField } from './fields/SliderField';
import { ColorField } from './fields/ColorField';
import { ToggleField } from './fields/ToggleField';
import { NumberField } from './fields/NumberField';
import { ImageListField } from './fields/ImageListField';

interface SchemaFieldRendererProps {
  field: ISchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function SchemaFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: SchemaFieldRendererProps) {
  switch (field.fieldType) {
    case 'textarea':
      return <TextAreaField value={value as string ?? ''} onChange={onChange as (v: string) => void} disabled={disabled} />;
    case 'text':
      return <TextField value={value as string ?? ''} onChange={onChange as (v: string) => void} disabled={disabled} />;
    case 'select':
      return <SelectField field={field} value={value as string ?? ''} onChange={onChange as (v: string) => void} disabled={disabled} />;
    case 'slider':
      return <SliderField field={field} value={value as number ?? 0} onChange={onChange as (v: number) => void} disabled={disabled} />;
    case 'color':
      return <ColorField value={value as string ?? '#000000'} onChange={onChange as (v: string) => void} disabled={disabled} />;
    case 'toggle':
      return <ToggleField value={value as boolean ?? false} onChange={onChange as (v: boolean) => void} disabled={disabled} />;
    case 'number':
      return <NumberField field={field} value={value as number ?? 0} onChange={onChange as (v: number) => void} disabled={disabled} />;
    case 'imageList':
      return <ImageListField value={(value as string[]) ?? []} onChange={onChange as (v: string[]) => void} disabled={disabled} />;
    default:
      return <TextField value={value as string ?? ''} onChange={onChange as (v: string) => void} disabled={disabled} />;
  }
}
