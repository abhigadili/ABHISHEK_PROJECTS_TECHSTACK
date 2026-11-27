'use client';
import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/common/ui';

/** Imperative API exposed to parents (instead of handing out the raw <input>): `open()` and `clear()`. */
export interface FileUploadHandle { open: () => void; clear: () => void }

/**
 * Safe file picker for use inside a <form>: it validates type and size in the browser (UX), the Server Action re-validates the same
 * rules, and the backend checks the file's magic bytes. `forwardRef` + `useImperativeHandle` expose only what a parent may call.
 */
export const FileUpload = forwardRef<FileUploadHandle, { name?: string; accept: string; maxBytes?: number; label?: string; onPick?: (f: File | null) => void }>(
  function FileUpload({ name = 'file', accept, maxBytes = 2 * 1024 * 1024, label = 'Choose file', onPick }, ref) {
    const input = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState('');
    const id = useId();
    useImperativeHandle(ref, () => ({ open: () => input.current?.click(), clear: () => { if (input.current) input.current.value = ''; setPicked(''); setError(null); onPick?.(null); } }), [onPick]);
    return (
      <div>
        <input ref={input} id={id} name={name} type="file" accept={accept} className="sr-only" data-testid="file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (!accept.split(',').map((s) => s.trim()).includes(f.type)) { setError(`Unsupported file type (${f.type || 'unknown'})`); e.target.value = ''; onPick?.(null); return; }
            if (f.size > maxBytes) { setError(`File is too large (max ${maxBytes / 1048576} MB)`); e.target.value = ''; onPick?.(null); return; }
            setError(null); setPicked(f.name); onPick?.(f);
          }} />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}>{label}</Button>
        {picked && <span className="ml-2 text-sm text-muted">{picked}</span>}
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);
