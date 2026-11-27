'use client';
import { Camera, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, uploadWithProgress } from '@/lib/api';
import { Alert, Avatar, Button, ConfirmDialog } from '@/components/ui';
import { errMsg } from '@/hooks/useApi';
import { useToast } from '@/components/toast';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 2 * 1024 * 1024;
export function checkImage(f: File): string | null {
  if (!TYPES.includes(f.type)) return 'Choose a JPEG, PNG or WebP image.';
  if (f.size > MAX_BYTES) return `Image must be smaller than ${MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

/** Profile picture on the profile page: preview, upload with progress, replace, remove. */
export function PictureUploader({ userId, name, hasPicture, version, onChanged }: { userId: number; name: string; hasPicture: boolean; version?: string | null; onChanged: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => { if (!file) { setPreview(null); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);

  const pick = (f: File | undefined) => { setError(null); if (!f) return; const e = checkImage(f); if (e) { setError(e); setFile(null); return; } setFile(f); };
  const upload = async () => {
    if (!file) return; setError(null); setProgress(0);
    const fd = new FormData(); fd.append('picture', file);
    try { await uploadWithProgress('PUT', `/users/${userId}/picture`, fd, setProgress); toast.success('Profile picture saved'); setFile(null); if (input.current) input.current.value = ''; onChanged(); }
    catch (e) { setError(errMsg(e)); } finally { setProgress(null); }
  };
  const remove = async () => { setRemoving(true); try { await api.del(`/users/${userId}/picture`); toast.success('Profile picture removed'); setConfirm(false); onChanged(); } catch (e) { toast.error(errMsg(e)); } finally { setRemoving(false); } };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {preview ? <img src={preview} alt="Preview of the selected picture" className="h-28 w-28 rounded-full object-cover ring-2 ring-brand-300" /> : <Avatar userId={userId} name={name} hasPicture={hasPicture} version={version} size={112} />}
      <div className="space-y-3">
        <input ref={input} type="file" accept={TYPES.join(',')} className="sr-only" id={`pic-${userId}`} onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => input.current?.click()}><Camera className="h-4 w-4" />{hasPicture || file ? 'Choose another' : 'Choose picture'}</Button>
          {file && <Button onClick={upload} loading={progress !== null}><Upload className="h-4 w-4" />Upload{progress !== null ? ` ${progress}%` : ''}</Button>}
          {file && progress === null && <Button variant="ghost" onClick={() => { setFile(null); if (input.current) input.current.value = ''; }}>Cancel</Button>}
          {hasPicture && !file && <Button variant="ghost" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />Remove</Button>}
        </div>
        {progress !== null && <div className="h-2 w-56 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div>}
        <p className="text-xs text-slate-500">JPEG, PNG or WebP, up to 2 MB. The image is stored in the library database.</p>
        {error && <Alert>{error}</Alert>}
      </div>
      <ConfirmDialog open={confirm} title="Remove profile picture?" message="The default avatar will be shown instead." confirmLabel="Remove" danger loading={removing} onConfirm={remove} onCancel={() => setConfirm(false)} />
    </div>
  );
}
