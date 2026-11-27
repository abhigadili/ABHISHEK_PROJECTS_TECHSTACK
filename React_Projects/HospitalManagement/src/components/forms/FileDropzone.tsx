import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/format';

export interface FileDropzoneHandle {
  clear: () => void;
  openPicker: () => void;
  getFile: () => File | null;
}

interface Props {
  accept?: string[]; // mime types
  maxBytes?: number;
  onFileChange?: (file: File | null) => void;
  disabled?: boolean;
}

/**
 * File upload form control: drag & drop + picker, client-side type/size validation (mirrors the backend's rule for
 * report attachments: PDF/PNG/JPEG, max 5 MB). Uncontrolled file input + useImperativeHandle API.
 */
export const FileDropzone = forwardRef<FileDropzoneHandle, Props>(function FileDropzone({ accept = ['application/pdf', 'image/png', 'image/jpeg'], maxBytes = 5 * 1024 * 1024, onFileChange, disabled }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const take = useCallback(
    (f: File | null) => {
      setError(null);
      if (f) {
        if (!accept.includes(f.type)) return setError('Only PDF, PNG or JPEG files are accepted.');
        if (f.size > maxBytes) return setError(`File is too large (${formatBytes(f.size)}). Maximum is ${formatBytes(maxBytes)}.`);
      }
      setFile(f);
      onFileChange?.(f);
    },
    [accept, maxBytes, onFileChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        if (input.current) input.current.value = '';
        take(null);
      },
      openPicker: () => input.current?.click(),
      getFile: () => file,
    }),
    [file, take],
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files[0] ?? null); }}
        onClick={() => !disabled && input.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose a file to upload"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm transition-colors', over && 'border-brand-500 bg-brand-50 dark:bg-brand-900/20', disabled && 'cursor-not-allowed opacity-60')}
      >
        <FileUp className="h-6 w-6 text-muted" />
        {file ? (
          <span className="flex items-center gap-2 font-medium">
            {file.name} <span className="text-muted">({formatBytes(file.size)})</span>
            <button type="button" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); if (input.current) input.current.value = ''; take(null); }} className="rounded p-0.5 hover:bg-black/10"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : (
          <span className="text-muted">Drop a PDF, PNG or JPEG here or <span className="font-medium text-brand-600">browse</span> (max {formatBytes(maxBytes)})</span>
        )}
        <input ref={input} type="file" hidden accept={accept.join(',')} onChange={(e) => take(e.target.files?.[0] ?? null)} disabled={disabled} data-testid="file-input" />
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
