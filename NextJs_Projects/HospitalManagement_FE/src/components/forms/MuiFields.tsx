'use client';
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { MenuItem, TextField, type TextFieldProps } from '@mui/material';
/** MUI inputs wired to React Hook Form with useController (controlled components). */
type B<T extends FieldValues> = { control: Control<T>; name: Path<T>; label: string; required?: boolean };
export function MuiText<T extends FieldValues>({ control, name, label, required, ...rest }: B<T> & Omit<TextFieldProps, 'name' | 'label' | 'required' | 'defaultValue'>) {
  const { field, fieldState } = useController({ control, name });
  return <TextField {...rest} {...field} value={field.value ?? ''} label={label} required={required} error={!!fieldState.error} helperText={fieldState.error?.message ?? rest.helperText} />;
}
export function MuiSelect<T extends FieldValues>({ control, name, label, options, required }: B<T> & { options: { value: string | number; label: string }[] }) {
  const { field, fieldState } = useController({ control, name });
  return <TextField select {...field} value={field.value ?? ''} label={label} required={required} error={!!fieldState.error} helperText={fieldState.error?.message}>{options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}</TextField>;
}
