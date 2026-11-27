'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { labRequestSchema, type LabRequestFormValues } from '@/lib/validations/clinical';
import { requestLabTestsAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, NativeSelect, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { fmtMoney } from '@/lib/utilities/format';
export interface TestOpt { id: number; name: string; code: string; price: number; category: string }
/** Scenario 4 (doctor): choose tests (checkbox group registered as an array), priority; urgent requests require clinical notes (conditional validation). */
export function LabRequestForm({ patient, appointmentId, hospitals, tests }: { patient: { id: number; name: string }; appointmentId?: number; hospitals: { id: number; name: string }[]; tests: TestOpt[] }) {
  const r = useRouter(); const [p, st] = useTransition(); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setError, control, formState: { errors } } = useForm<LabRequestFormValues>({ resolver: zodResolver(labRequestSchema) as never, defaultValues: { patientId: patient.id, appointmentId, hospitalId: hospitals[0]?.id, priority: 'ROUTINE', clinicalNotes: '', testIds: [] } });
  const chosen = (useWatch({ control, name: 'testIds' }) ?? []).map(Number); const total = tests.filter((t) => chosen.includes(t.id)).reduce((s, t) => s + t.price, 0);
  const submit = handleSubmit((v) => st(async () => { const x = await requestLabTestsAction({ ...v, testIds: (v.testIds as unknown[]).map(Number) }); if (x.ok) { emitToast({ kind: 'success', text: 'Laboratory request created' }); r.push(appointmentId ? `/doctor/appointments/${appointmentId}` : '/doctor/lab'); r.refresh(); } else { setErr(x.message ?? 'Failed'); for (const [k, m] of Object.entries(x.fieldErrors ?? {})) setError(k as keyof LabRequestFormValues, { message: m }); } }));
  const cats = [...new Set(tests.map((t) => t.category))];
  return <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>{err && <Alert tone="danger">{err}</Alert>}
    <Card><CardHeader><CardTitle>Patient: {patient.name}</CardTitle></CardHeader><CardBody className="grid gap-4 md:grid-cols-2"><Field label="Hospital laboratory" htmlFor="h" error={errors.hospitalId?.message}><NativeSelect id="h" {...register('hospitalId', { valueAsNumber: true })}>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</NativeSelect></Field><Field label="Priority" htmlFor="pr"><NativeSelect id="pr" {...register('priority')}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="STAT">STAT</option></NativeSelect></Field></CardBody></Card>
    <Card><CardHeader><CardTitle>Tests</CardTitle><span className="num text-sm text-muted">Estimated {fmtMoney(total)}</span></CardHeader><CardBody className="space-y-4">{cats.map((c) => <fieldset key={c}><legend className="mb-1 text-sm font-medium">{c}</legend><div className="grid gap-2 sm:grid-cols-2">{tests.filter((t) => t.category === c).map((t) => <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line p-2 text-sm hover:bg-surface2"><input type="checkbox" value={t.id} className="size-4" {...register('testIds')} />{t.name} <span className="ml-auto text-xs text-muted">{fmtMoney(t.price)}</span></label>)}</div></fieldset>)}{errors.testIds && <p role="alert" className="text-xs text-danger">{(errors.testIds as { message?: string }).message}</p>}</CardBody></Card>
    <Field label="Clinical notes" htmlFor="n" error={errors.clinicalNotes?.message} hint="Required for urgent and STAT requests"><Textarea id="n" rows={3} {...register('clinicalNotes')} /></Field><Button type="submit" loading={p}>Submit request</Button></form>;
}
