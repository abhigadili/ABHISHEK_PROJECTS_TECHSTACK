'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { recordSchema, type RecordFormValues } from '@/lib/validations/clinical';
import { createRecordAction, uploadRecordDocumentAction } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { emitToast } from '@/components/ui/toast';
/** Medical record entry (consultation notes / diagnosis / allergy ...): RHF + Zod (conditional rule: diagnosis text for DIAGNOSIS) + optional file attachment. */
export function RecordForm({ patientId, appointmentId }: { patientId: number; appointmentId?: number }) {
  const r = useRouter(); const [p, st] = useTransition(); const [file, setFile] = useState<File | null>(null); const [fileErr, setFileErr] = useState('');
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<RecordFormValues>({ resolver: zodResolver(recordSchema) as never, defaultValues: { patientId, appointmentId, type: 'CONSULTATION', title: '', diagnosis: '', notes: '' } });
  const submit = handleSubmit((v) => st(async () => {
    const x = await createRecordAction(v);
    if (!x.ok) { for (const [k, m] of Object.entries(x.fieldErrors ?? {})) setError(k as keyof RecordFormValues, { message: m }); emitToast({ kind: 'error', text: x.message ?? '' }); return; }
    if (file && x.data) { const fd = new FormData(); fd.append('file', file); const u = await uploadRecordDocumentAction(x.data.id, fd); if (!u.ok) { setFileErr(u.fieldErrors?.file ?? u.message ?? 'Upload failed'); emitToast({ kind: 'error', text: `Record saved, but the file failed: ${u.message}` }); r.refresh(); return; } }
    emitToast({ kind: 'success', text: 'Record saved' }); reset({ patientId, appointmentId, type: 'CONSULTATION', title: '', diagnosis: '', notes: '' }); setFile(null); r.refresh();
  }));
  return <form onSubmit={submit} className="grid gap-3 md:grid-cols-2" noValidate><Field label="Type" htmlFor="type"><NativeSelect id="type" {...register('type')}>{['CONSULTATION', 'DIAGNOSIS', 'NOTE', 'ALLERGY', 'TREATMENT', 'HISTORY'].map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}</NativeSelect></Field><Field label="Title" htmlFor="title" required error={errors.title?.message}><Input id="title" {...register('title')} /></Field><Field label="Diagnosis" htmlFor="dx" error={errors.diagnosis?.message}><Input id="dx" {...register('diagnosis')} /></Field><Field label="Attachment (PDF/PNG/JPEG, ≤ 5 MB)" htmlFor="file" error={fileErr}><Input id="file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setFileErr(f && f.size > 5 * 1024 * 1024 ? 'File exceeds 5 MB' : ''); }} /></Field><div className="md:col-span-2"><Field label="Clinical notes" htmlFor="notes" error={errors.notes?.message}><AutoTextarea id="notes" rows={4} maxLength={8000} {...register('notes')} /></Field></div><div className="md:col-span-2"><Button type="submit" loading={p} disabled={!!fileErr}>Save record</Button></div></form>;
}
