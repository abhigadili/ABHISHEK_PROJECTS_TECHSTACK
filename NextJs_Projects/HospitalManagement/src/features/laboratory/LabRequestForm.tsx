'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { createLabRequestsAction } from '@/actions/laboratory';
import { labRequestSchema, type LabRequestFormValues } from '@/schemas/laboratory';
import { PatientPicker } from '@/features/common/PatientPicker';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utilities/format';
import type { Doctor, LabTest, Patient } from '@/types';

/** Scenario 4 - request one or more tests (React Hook Form + useFieldArray + Zod). Partial failures are reported by the Server Action (Promise.allSettled). */
export function LabRequestForm({ tests, doctors, fixedDoctorId, initialPatient }: { tests: LabTest[]; doctors: Doctor[]; fixedDoctorId: number | null; initialPatient: Patient | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [err, setErr] = useState<string | null>(null);
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm<LabRequestFormValues>({ resolver: zodResolver(labRequestSchema), mode: 'onTouched', defaultValues: { patientId: initialPatient?.id ?? (undefined as unknown as number), doctorId: fixedDoctorId ?? (undefined as unknown as number), priority: 'ROUTINE', clinicalNotes: '', tests: [{ testCode: '' }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'tests' });
  const chosen = useWatch({ control, name: 'tests' }) ?? [];
  const total = chosen.reduce((s, t) => s + (tests.find((x) => x.code === t.testCode)?.price ?? 0), 0);
  const submit = handleSubmit((v) => { setErr(null); start(async () => {
    const r = await createLabRequestsAction(v);
    if (r.ok) { emitToast({ kind: r.data?.failed.length ? 'info' : 'success', text: r.message! }); router.push(r.data?.created.length === 1 ? `/laboratory/${r.data.created[0].id}` : '/laboratory'); return; }
    setErr(r.message ?? 'Request failed'); for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as never, { message: m });
  }); });
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
      {err && <Alert tone="danger">{err}</Alert>}
      <Card><CardHeader><CardTitle>Patient</CardTitle></CardHeader><CardBody className="grid gap-4 md:grid-cols-2">
        <div><label className="mb-1 block text-sm font-medium">Patient *</label><PatientPicker value={patient} onChange={(p) => { setPatient(p); setValue('patientId', p?.id as number, { shouldValidate: true }); }} error={errors.patientId?.message} /></div>
        <Field label="Requesting doctor" htmlFor="doctorId" required error={errors.doctorId?.message}>{fixedDoctorId ? <p className="text-sm">{doctors.find((d) => d.id === fixedDoctorId)?.fullName}</p> : <Select id="doctorId" {...register('doctorId', { valueAsNumber: true })}><option value="">Select doctor…</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</Select>}</Field>
      </CardBody></Card>
      <Card><CardHeader><CardTitle>Tests</CardTitle><span className="num text-sm text-muted">Estimated {formatCurrency(total)}</span></CardHeader><CardBody className="space-y-3">
        {fields.map((f, i) => <div key={f.id} className="flex gap-2"><div className="flex-1"><Select aria-label={`Test ${i + 1}`} {...register(`tests.${i}.testCode`)}><option value="">Choose a test…</option>{tests.map((t) => <option key={t.code} value={t.code}>{t.name} ({t.code}) · {formatCurrency(t.price)}</option>)}</Select>{errors.tests?.[i]?.testCode && <p className="mt-1 text-xs text-danger">{errors.tests[i]?.testCode?.message}</p>}</div><Button type="button" variant="ghost" size="icon" aria-label={`Remove test ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 className="size-4 text-danger" /></Button></div>)}
        {errors.tests?.message && <p className="text-xs text-danger">{errors.tests.message}</p>}
        <Button type="button" variant="outline" onClick={() => append({ testCode: '' })}><Plus className="size-4" />Add test</Button>
      </CardBody></Card>
      <Card><CardBody className="grid gap-4 md:grid-cols-3">
        <Field label="Priority" htmlFor="priority"><Select id="priority" {...register('priority')}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="STAT">STAT</option></Select></Field>
        <div className="md:col-span-2"><Field label="Clinical notes" htmlFor="clinicalNotes" error={errors.clinicalNotes?.message} hint="Required for urgent and STAT requests"><Textarea id="clinicalNotes" rows={2} {...register('clinicalNotes')} /></Field></div>
      </CardBody></Card>
      <Button type="submit" loading={pending}>Submit request</Button>
    </form>
  );
}
