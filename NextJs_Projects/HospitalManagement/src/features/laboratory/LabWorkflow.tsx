'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { createLabReportAction, setLabStatusAction } from '@/actions/laboratory';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import type { LabStatus } from '@/types';
import type { ActionState } from '@/lib/actions/state';

const NEXT: Partial<Record<LabStatus, { to: LabStatus; label: string }>> = { REQUESTED: { to: 'SAMPLE_COLLECTED', label: 'Mark sample collected' }, SAMPLE_COLLECTED: { to: 'IN_PROGRESS', label: 'Start processing' } };

export function StatusAdvance({ id, status }: { id: number; status: LabStatus }) {
  const [pending, start] = useTransition();
  const n = NEXT[status];
  if (!n) return null;
  return <Button loading={pending} onClick={() => start(async () => { const r = await setLabStatusAction(id, n.to); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}>{n.label}</Button>;
}

export function ReportForm({ requestId }: { requestId: number }) {
  const [s, action] = useActionState<ActionState, FormData>(createLabReportAction, { ok: false });
  useEffect(() => { if (s.ok) emitToast({ kind: 'success', text: s.message! }); }, [s]);
  const e = s.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl space-y-3" noValidate><input type="hidden" name="requestId" value={requestId} />
      {s.message && !s.ok && !Object.keys(e).length && <Alert tone="danger">{s.message}</Alert>}
      <Field label="Result summary" htmlFor="resultSummary" required error={e.resultSummary}><Textarea id="resultSummary" name="resultSummary" rows={2} aria-invalid={!!e.resultSummary} /></Field>
      <Field label="Details" htmlFor="resultDetails"><Textarea id="resultDetails" name="resultDetails" rows={3} /></Field>
      <Field label="Reference range" htmlFor="referenceRange"><Input id="referenceRange" name="referenceRange" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="abnormal" className="size-4" />Result is abnormal</label>
      <SubmitButton pendingText="Saving…">Save report</SubmitButton>
    </form>
  );
}

/** File upload: multipart POST (fetch + FormData) to the Next.js Route Handler, which validates type/size and forwards to the Laboratory service. */
export function AttachmentUpload({ requestId }: { requestId: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const upload = async () => {
    const f = input.current?.files?.[0]; if (!f) return setMsg('Choose a file first');
    if (f.size > 5 * 1024 * 1024) return setMsg('File is larger than 5 MB'); // client-side check; the Route Handler enforces it again
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append('file', f);
    const res = await fetch(`/api/lab/requests/${requestId}/attachment`, { method: 'POST', body: fd });
    setBusy(false);
    if (res.ok) { emitToast({ kind: 'success', text: 'Attachment uploaded' }); if (input.current) input.current.value = ''; router.refresh(); } else setMsg(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? 'Upload failed');
  };
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" aria-label="Report attachment" className="text-sm" /><Button variant="outline" loading={busy} onClick={upload}><Upload className="size-4" />Upload</Button></div>{msg && <p role="alert" className="text-sm text-danger">{msg}</p>}<p className="text-xs text-muted">PDF, PNG or JPEG, up to 5 MB.</p></div>;
}
