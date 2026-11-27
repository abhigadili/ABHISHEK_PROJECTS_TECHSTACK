import { MenuItem, TextField } from '@mui/material';
import { useId } from 'react';

export interface Option {
  value: string;
  label: string;
}

/** Generic dropdown filter. `useId` gives each instance a unique, SSR-safe id so the label is programmatically tied to the control. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  minWidth = 170,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  allLabel?: string;
  minWidth?: number;
}) {
  const id = useId();
  return (
    <TextField
      select
      id={id}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth }}
      fullWidth={false}
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
