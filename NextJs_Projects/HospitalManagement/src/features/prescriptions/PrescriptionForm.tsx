'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorMessage, Field, FieldArray, Form, Formik, type FormikHelpers } from 'formik';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { createPrescriptionAction } from '@/actions/prescriptions';
import { emptyItem, FREQUENCIES, prescriptionSchema, type PrescriptionFormValues } from '@/schemas/prescription';
import { zodValidate } from '@/lib/utilities/formikZod';
import { PatientPicker } from '@/features/common/PatientPicker';
import { pharmacyApi } from '@/services/api/clientApis';
import { keys } from '@/services/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { cn } from '@/lib/utilities/cn';
import type { Doctor, Patient } from '@/types';

const input = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary';
const Err = ({ name }: { name: string }) => <ErrorMessage name={name} render={(m) => <p role="alert" className="mt-0.5 text-xs text-danger">{typeof m === 'string' ? m : ''}</p>} />;

/**
 * Scenario 5 - Prescription generation. Formik (<Formik>, <Form>, <Field>, <FieldArray>, <ErrorMessage>, setFieldValue, validateForm) with the Zod schema
 * as validator. Dynamic medicine rows via FieldArray; the Server Action validates again, including the duplicate-medicine rule.
 */
export function PrescriptionForm({ doctors, fixedDoctorId, initialPatient }: { doctors: Doctor[]; fixedDoctorId: number | null; initialPatient: Patient | null }) {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [serverError, setServerError] = useState<string | null>(null);
  const meds = useQuery({ queryKey: keys.pharmacy.medicines, queryFn: ({ signal }) => pharmacyApi.medicines(signal), staleTime: 5 * 60_000, retry: false, meta: { silent: true } });
  const initial: PrescriptionFormValues = { patientId: initialPatient?.id ?? (0 as number), doctorId: fixedDoctorId ?? 0, appointmentId: null, diagnosis: '', notes: '', validDays: 30, items: [{ ...emptyItem }] };

  const onSubmit = async (values: PrescriptionFormValues, h: FormikHelpers<PrescriptionFormValues>) => {
    setServerError(null);
    const r = await createPrescriptionAction(values);
    if (r.ok && r.data) { emitToast({ kind: 'success', text: r.message! }); router.push(`/prescriptions/${r.data.id}`); return; }
    setServerError(r.message ?? 'Could not create the prescription');
    for (const [k, m] of Object.entries(r.fieldErrors ?? {})) h.setFieldError(k, m);
    h.setSubmitting(false);
  };
  return (
    <Formik<PrescriptionFormValues> initialValues={initial} validate={zodValidate(prescriptionSchema)} onSubmit={onSubmit} validateOnBlur>
      {({ values, isSubmitting, setFieldValue, errors, touched, dirty, validateForm, setTouched }) => (
        <Form className="space-y-6" noValidate>
          {serverError && <Alert tone="danger">{serverError}</Alert>}
          <Card><CardHeader><CardTitle>Patient & prescriber</CardTitle></CardHeader><CardBody className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium">Patient *</label><PatientPicker value={patient} onChange={(p) => { setPatient(p); void setFieldValue('patientId', p?.id ?? 0); }} error={touched.patientId ? (errors.patientId as string) : undefined} /></div>
            <div><label htmlFor="doctorId" className="mb-1 block text-sm font-medium">Prescribing doctor *</label>
              {fixedDoctorId ? <p className="text-sm">{doctors.find((d) => d.id === fixedDoctorId)?.fullName}</p> : <Field as="select" id="doctorId" name="doctorId" className={input} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFieldValue('doctorId', Number(e.target.value))}><option value={0}>Select doctor…</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName} · {d.specialization}</option>)}</Field>}<Err name="doctorId" /></div>
          </CardBody></Card>
          <Card><CardHeader><CardTitle>Diagnosis</CardTitle></CardHeader><CardBody className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2"><label htmlFor="diagnosis" className="mb-1 block text-sm font-medium">Diagnosis *</label><Field id="diagnosis" name="diagnosis" className={input} /><Err name="diagnosis" /></div>
            <div><label htmlFor="validDays" className="mb-1 block text-sm font-medium">Valid for (days)</label><Field id="validDays" name="validDays" type="number" className={input} /><Err name="validDays" /></div>
            <div className="md:col-span-3"><label htmlFor="notes" className="mb-1 block text-sm font-medium">Notes</label><Field as="textarea" id="notes" name="notes" rows={2} className={cn(input, 'h-auto py-2')} /></div>
          </CardBody></Card>
          <Card><CardHeader><CardTitle>Medicines</CardTitle></CardHeader><CardBody>
            <datalist id="medicine-names">{(meds.data ?? []).filter((m) => m.active).map((m) => <option key={m.id} value={m.name} />)}</datalist>
            <FieldArray name="items">{({ push, remove }) => (
              <div className="space-y-3">
                {values.items.map((_, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3 md:grid-cols-12">
                    <div className="col-span-2 md:col-span-4"><label className="text-xs text-muted">Medicine *</label><Field name={`items.${i}.medicineName`} list="medicine-names" className={input} autoComplete="off" /><Err name={`items.${i}.medicineName`} /></div>
                    <div className="md:col-span-2"><label className="text-xs text-muted">Dosage *</label><Field name={`items.${i}.dosage`} placeholder="500mg" className={input} /><Err name={`items.${i}.dosage`} /></div>
                    <div className="md:col-span-2"><label className="text-xs text-muted">Frequency</label><Field as="select" name={`items.${i}.frequency`} className={input}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</Field></div>
                    <div className="md:col-span-1"><label className="text-xs text-muted">Days</label><Field name={`items.${i}.durationDays`} type="number" className={input} /><Err name={`items.${i}.durationDays`} /></div>
                    <div className="md:col-span-1"><label className="text-xs text-muted">Qty</label><Field name={`items.${i}.quantity`} type="number" className={input} /><Err name={`items.${i}.quantity`} /></div>
                    <div className="col-span-2 flex items-end md:col-span-2"><Field name={`items.${i}.instructions`} placeholder="Instructions" aria-label="Instructions" className={input} />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove medicine ${i + 1}`} disabled={values.items.length === 1} onClick={() => remove(i)}><Trash2 className="size-4 text-danger" /></Button></div>
                  </div>
                ))}
                {typeof errors.items === 'string' && <p role="alert" className="text-xs text-danger">{errors.items}</p>}
                <Button type="button" variant="outline" onClick={() => push({ ...emptyItem })}><Plus className="size-4" />Add medicine</Button>
              </div>)}</FieldArray>
          </CardBody></Card>
          <div className="flex gap-2"><Button type="submit" loading={isSubmitting}>Generate prescription</Button><Button type="button" variant="ghost" disabled={!dirty} onClick={async () => { setTouched({ patientId: true } as never); await validateForm(); }}>Check form</Button></div>
        </Form>
      )}
    </Formik>
  );
}
