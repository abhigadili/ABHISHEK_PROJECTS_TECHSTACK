import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, FlaskConical, Plus, Trash2, XCircle } from 'lucide-react';
import { useCreateLabRequests, useLabTests } from '../hooks/useLab';
import { labRequestSchema, type LabRequestFormValues } from '@/schemas/laboratory';
import { PageHeader } from '@/components/common/PageHeader';
import { PatientPicker } from '@/components/common/PatientPicker';
import { Notice } from '@/components/common/Notice';
import { LabPriorityBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentDoctor } from '@/features/authentication/hooks/useCurrentIdentity';
import { useDoctorList } from '@/features/doctors/hooks/useDoctors';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { formatCurrency, emptyToNull } from '@/utils/format';
import type { LabRequest, Patient } from '@/types';

/**
 * Scenario 4 (part 1) - request lab tests. React Hook Form + Zod + useFieldArray (dynamic rows: one per test).
 * Submit fires one POST per test in parallel (Promise.allSettled) and reports each outcome. Urgent/STAT priority makes
 * clinical notes mandatory (conditional validation), duplicate tests are rejected (cross-row validation).
 */
export default function RequestLabTestPage() {
  const [params] = useSearchParams();
  const { role } = useAuth();
  const own = useCurrentDoctor();
  const tests = useLabTests();
  const doctors = useDoctorList({ active: true, size: 100 });
  const create = useCreateLabRequests();
  const [patient, setPatient] = useState<Patient | null>(null);
  const preId = Number(params.get('patientId')) || 0;
  const pre = usePatient(preId, preId > 0 && !patient);
  const activePatient = patient ?? pre.data ?? null;
  const [outcome, setOutcome] = useState<Array<{ testCode: string; ok: boolean; request?: LabRequest; error?: string }> | null>(null);

  const initialCode = params.get('testCode');
  const { control, handleSubmit, register, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<LabRequestFormValues>({
    resolver: zodResolver(labRequestSchema),
    defaultValues: { patientId: undefined as unknown as number, doctorId: undefined as unknown as number, appointmentId: Number(params.get('appointmentId')) || null, priority: 'ROUTINE', clinicalNotes: '', tests: [{ testCode: initialCode ?? '' }] },
    values: undefined,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'tests' });
  const priority = watch('priority');
  const selected = watch('tests');
  const preDoctor = Number(params.get('doctorId')) || undefined;
  // keep the form values in sync with identities that are resolved asynchronously (route params / doctor profile / preloaded patient)
  useEffect(() => { if (role === 'DOCTOR' && own.doctor) setValue('doctorId', own.doctor.id); else if (preDoctor) setValue('doctorId', preDoctor); }, [role, own.doctor, preDoctor, setValue]);
  useEffect(() => { if (activePatient) setValue('patientId', activePatient.id); }, [activePatient, setValue]);
  const total = useMemo(() => selected.reduce((s, t) => s + (tests.data?.find((x) => x.code === t.testCode)?.price ?? 0), 0), [selected, tests.data]);

  if (outcome) {
    const ok = outcome.filter((o) => o.ok);
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Lab request submitted" subtitle={`${ok.length} of ${outcome.length} test requests accepted`} icon={<FlaskConical className="h-5 w-5" />} />
        <Card className="divide-y divide-[var(--hms-border)]">
          {outcome.map((o) => (
            <div key={o.testCode} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="flex items-center gap-2">{o.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}<b>{o.request?.testName ?? o.testCode}</b>{o.request && <LabPriorityBadge status={o.request.priority} />}</span>
              {o.ok && o.request ? <Link className="font-semibold text-brand-600 hover:underline" to={`/lab/requests/${o.request.id}`}>Request #{o.request.id}</Link> : <span className="text-red-700">{o.error}</span>}
            </div>
          ))}
        </Card>
        <Notice>Accession numbers are assigned a moment later by the Laboratory Service (Kafka consumer) and a lab bill is created by Billing.</Notice>
        <div className="flex gap-2"><Button asChild><Link to="/lab/requests">View requests</Link></Button><Button variant="outline" onClick={() => { setOutcome(null); reset(); }}>New request</Button></div>
      </div>
    );
  }

  const onSubmit = handleSubmit(async (v) => {
    const res = await create.mutateAsync(v.tests.map((t) => ({ patientId: v.patientId, doctorId: v.doctorId, appointmentId: v.appointmentId ?? null, testCode: t.testCode, priority: v.priority, clinicalNotes: emptyToNull(v.clinicalNotes) })));
    setOutcome(res);
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Request lab tests" subtitle="Select one or more investigations for a patient" icon={<FlaskConical className="h-5 w-5" />} />
      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Lab request form">
        <Card className="space-y-4 p-5">
          <PatientPicker value={activePatient} onChange={(p) => { setPatient(p); setValue('patientId', p?.id as number, { shouldValidate: true }); }} error={errors.patientId?.message} />
          {role === 'DOCTOR' ? <p className="text-sm text-muted">Requesting as <b>{own.doctor?.fullName ?? '…'}</b></p> : (
            <div className="grid gap-1.5"><Label>Requesting doctor</Label>
              <Controller control={control} name="doctorId" render={({ field }) => (<Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(Number(v))}><SelectTrigger aria-label="Requesting doctor"><SelectValue placeholder="Select a doctor" /></SelectTrigger><SelectContent>{doctors.data?.content.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.fullName} — {d.specialization}</SelectItem>)}</SelectContent></Select>)} />
              {errors.doctorId && <p className="text-xs text-red-600">{errors.doctorId.message}</p>}</div>
          )}
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Tests</h2><span className="text-sm text-muted">Estimated charge: <b className="text-fg">{formatCurrency(total)}</b></span></div>
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-start gap-2">
              <div className="flex-1">
                <Controller control={control} name={`tests.${i}.testCode`} render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}><SelectTrigger aria-label={`Test ${i + 1}`}><SelectValue placeholder="Choose a test" /></SelectTrigger><SelectContent>{tests.data?.map((t) => <SelectItem key={t.code} value={t.code}>{t.name} · {formatCurrency(t.price)}</SelectItem>)}</SelectContent></Select>
                )} />
                {errors.tests?.[i]?.testCode && <p className="mt-1 text-xs text-red-600">{errors.tests[i]?.testCode?.message}</p>}
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove test ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
            </div>
          ))}
          {errors.tests?.message && <p className="text-xs text-red-600">{errors.tests.message}</p>}
          <Button type="button" variant="outline" size="sm" onClick={() => append({ testCode: '' })}><Plus className="h-4 w-4" /> Add another test</Button>
        </Card>
        <Card className="space-y-4 p-5">
          <div className="grid gap-1.5 sm:max-w-xs"><Label>Priority</Label>
            <Controller control={control} name="priority" render={({ field }) => (<Select value={field.value} onValueChange={field.onChange}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ROUTINE">Routine</SelectItem><SelectItem value="URGENT">Urgent</SelectItem><SelectItem value="STAT">STAT (immediate)</SelectItem></SelectContent></Select>)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="notes">Clinical notes{priority !== 'ROUTINE' ? ' (required)' : ' (optional)'}</Label><Textarea id="notes" rows={3} {...register('clinicalNotes')} aria-invalid={!!errors.clinicalNotes} />{errors.clinicalNotes && <p className="text-xs text-red-600">{errors.clinicalNotes.message}</p>}</div>
        </Card>
        {(role === 'DOCTOR' && !own.isPending && !own.doctor) && <Notice tone="warning">Your login has no doctor profile; lab requests must be made under a doctor's name.</Notice>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" asChild><Link to="/lab/requests">Cancel</Link></Button><Button type="submit" disabled={isSubmitting || create.isPending}>{create.isPending ? 'Submitting…' : `Submit ${fields.length > 1 ? `${fields.length} requests` : 'request'}`}</Button></div>
      </form>
    </div>
  );
}
