import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import { forwardRef, useId, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react';

/** Imperative API exposed to parents through `ref` (instead of lifting every DOM detail into props). */
export interface FileUploadHandle {
  open: () => void;
  clear: () => void;
}

interface Props {
  accept: string;
  maxBytes: number;
  label?: string;
  progress?: number | null;
  disabled?: boolean;
  onFile: (file: File) => void | Promise<void>;
}

/**
 * File input with client-side checks (type + size). Validation here is a courtesy: the backend re-checks the declared MIME *and*
 * the file's magic bytes. `forwardRef` + `useImperativeHandle` expose `open()`/`clear()`; the `<input>` itself stays private.
 */
export const FileUpload = forwardRef<FileUploadHandle, Props>(function FileUpload(
  { accept, maxBytes, label = 'Choose file', progress = null, disabled, onFile },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null); // useRef → direct DOM access for the hidden file input
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  useImperativeHandle(
    ref,
    () => ({
      open: () => inputRef.current?.click(),
      clear: () => {
        if (inputRef.current) inputRef.current.value = '';
        setName('');
        setError(null);
      },
    }),
    [],
  );

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = accept.split(',').map((a) => a.trim());
    if (!allowed.includes(file.type)) {
      setError(`Unsupported file type. Allowed: ${allowed.join(', ')}`);
      return;
    }
    if (file.size > maxBytes) {
      setError(`File is too large (max ${(maxBytes / 1048576).toFixed(0)} MB).`);
      return;
    }
    setError(null);
    setName(file.name);
    await onFile(file);
    if (inputRef.current) inputRef.current.value = ''; // allow choosing the same file again
  };

  return (
    <Stack spacing={1}>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={onChange}
        disabled={disabled}
        data-testid="file-input"
      />
      <Box>
        <Button
          component="label"
          htmlFor={id}
          variant="outlined"
          startIcon={<UploadIcon />}
          disabled={disabled}
        >
          {label}
        </Button>
        {name && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {name}
          </Typography>
        )}
      </Box>
      {progress != null && progress < 100 && (
        <LinearProgress variant="determinate" value={progress} aria-label="Upload progress" />
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
});
