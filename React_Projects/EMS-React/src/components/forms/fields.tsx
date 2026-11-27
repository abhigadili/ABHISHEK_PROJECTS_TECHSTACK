import {
  Checkbox,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import { Controller, useController, useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { useId } from 'react';

interface BaseProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Text input bound to React Hook Form through `useController` (the hook form of <Controller/>). It reads the form from
 * <FormProvider> via `useFormContext`, so deeply nested sections need no `control` prop-drilling.
 * `useId` links label ↔ helper text for assistive technology.
 */
export function FormTextField<T extends FieldValues>({
  name,
  label,
  helperText,
  type = 'text',
  multiline,
  rows,
  required,
  disabled,
  placeholder,
  onBlurExtra,
  slotProps,
}: BaseProps<T> &
  Pick<TextFieldProps, 'type' | 'multiline' | 'rows' | 'placeholder' | 'slotProps'> & {
    onBlurExtra?: () => void;
  }) {
  const { control } = useFormContext<T>();
  const { field, fieldState } = useController({ name, control });
  const id = useId();
  const needsShrink = type === 'date' || type === 'datetime-local';
  return (
    <TextField
      {...field}
      id={id}
      label={label}
      type={type}
      multiline={multiline}
      rows={rows}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      value={field.value ?? ''}
      error={!!fieldState.error}
      helperText={fieldState.error?.message ?? helperText}
      onBlur={() => {
        field.onBlur();
        onBlurExtra?.();
      }}
      slotProps={{
        ...slotProps,
        inputLabel: needsShrink ? { shrink: true } : undefined,
        htmlInput: {
          'aria-describedby': `${id}-help`,
          ...(slotProps as { htmlInput?: object } | undefined)?.htmlInput,
        },
      }}
      FormHelperTextProps={{ id: `${id}-help` }}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Select using the `<Controller>` render-prop component — the other RHF binding style, shown side by side with `useController`. */
export function FormSelect<T extends FieldValues>({
  name,
  label,
  options,
  emptyLabel,
  helperText,
  disabled,
  required,
}: BaseProps<T> & { options: SelectOption[]; emptyLabel?: string }) {
  const { control } = useFormContext<T>();
  const id = useId();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          select
          id={id}
          label={label}
          {...field}
          value={field.value ?? ''}
          disabled={disabled}
          required={required}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
        >
          {emptyLabel !== undefined && <MenuItem value="">{emptyLabel}</MenuItem>}
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

export function FormCheckbox<T extends FieldValues>({
  name,
  label,
  disabled,
}: Omit<BaseProps<T>, 'helperText'>) {
  const { control } = useFormContext<T>();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                onBlur={field.onBlur}
                inputRef={field.ref}
                disabled={disabled}
              />
            }
            label={label}
          />
          {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
        </div>
      )}
    />
  );
}
