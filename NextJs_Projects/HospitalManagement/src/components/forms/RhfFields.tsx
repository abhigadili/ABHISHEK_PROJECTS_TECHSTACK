'use client';
import { Controller, useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { MenuItem, TextField, type TextFieldProps } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

/** Custom form components built on React Hook Form: useController (text), Controller (select / date picker) - controlled MUI inputs. */
type Base<T extends FieldValues> = { control: Control<T>; name: Path<T>; label: string; required?: boolean };

export function RhfTextField<T extends FieldValues>({ control, name, label, required, ...rest }: Base<T> & Omit<TextFieldProps, 'name' | 'label' | 'required' | 'defaultValue'>) {
  const { field, fieldState } = useController({ control, name });
  return <TextField {...rest} {...field} value={field.value ?? ''} label={label} required={required} error={!!fieldState.error} helperText={fieldState.error?.message ?? rest.helperText} />;
}

export function RhfSelect<T extends FieldValues>({ control, name, label, options, required }: Base<T> & { options: { value: string | number; label: string }[] }) {
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <TextField select {...field} value={field.value ?? ''} label={label} required={required} error={!!fieldState.error} helperText={fieldState.error?.message}>
        {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </TextField>
    )} />
  );
}

export function RhfDate<T extends FieldValues>({ control, name, label, required, maxToday }: Base<T> & { maxToday?: boolean }) {
  return (
    <Controller control={control} name={name} render={({ field, fieldState }) => (
      <DatePicker label={label} value={field.value ? dayjs(field.value as string) : null} onChange={(d) => field.onChange(d && d.isValid() ? d.format('YYYY-MM-DD') : '')} maxDate={maxToday ? dayjs() : undefined} format="DD/MM/YYYY"
        slotProps={{ textField: { size: 'small', fullWidth: true, required, onBlur: field.onBlur, error: !!fieldState.error, helperText: fieldState.error?.message, inputRef: field.ref } }} />
    )} />
  );
}
