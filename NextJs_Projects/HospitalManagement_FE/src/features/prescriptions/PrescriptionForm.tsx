'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import { Plus, Trash2 } from 'lucide-react';
import { setIn } from 'formik';
import { prescriptionSchema } from '@/lib/validations/clinical';
import { createPrescriptionAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
const input = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary';
const Err = ({ name }: { name: string }) => <ErrorMessage name={name} render={(m) => <p role="alert" className="mt-0.5 text-xs text-danger">{typeof m === 'string' ? m : ''}</p>} />;
/** Formik bridge: Zod issue paths ("items.0.dosage") → nested errors via setIn, otherwise array-field messages never show. */
const validate = (values: unknown) => { const r = prescriptionSchema.safeParse(values); let e: Record<string, unknown> = {}; if (!r.success) for (const i of r.error.issues) { const path = i.path.join('.'); if (path) e = setIn(e, path, i.message); } return e; };
const blank = { medicineId: '' as unknown as number, dosage: '', frequency: 'Twice daily', durationDays: 5, quantity: 10, instructions: '' };
export interface MedOpt { id: number; name: string }
/** Scenario 5 (doctor): Formik + Zod, FieldArray of medicines (dynamic rows), nested errors, server re-validation and server field errors. */
export function PrescriptionForm({ patient, appointmentId, medicines }: { patient: { id: number; name: string }; appointmentId?: number; medicines: MedOpt[] }) {
  const router = useRouter(); const [err, setErr] = useState<string | null>(null);
  return (
    <Formik initialValues={{ patientId: patient.id, appointmentId, diagnosis: '', notes: '', validDays: 30, items: [{ ...blank }] }} validate={validate} onSubmit={async (v, h) => {
      setErr(null); const r = await createPrescriptionAction(v);
      if (r.ok && r.data) { emitToast({ kind: 'success', text: 'Prescription saved and the patient was notified' }); router.push(appointmentId ? `/doctor/appointments/${appointmentId}` : `/doctor/patients/${patient.id}`); router.refresh(); return; }
      setErr(r.message ?? 'Could not save'); for (const [k, m] of Object.entries(r.fieldErrors ?? {})) h.setFieldError(k, m); h.setSubmitting(false);
    }}>
      {({ values, isSubmitting, errors, setFieldValue }) => (
        <Form className="space-y-6" noValidate>
          {err && <Alert tone="danger">{err}</Alert>}
          <Card><CardHeader><CardTitle>Patient: {patient.name}</CardTitle></CardHeader><CardBody className="grid gap-4 md:grid-cols-3"><div className="md:col-span-2"><label htmlFor="diagnosis" className="mb-1 block text-sm font-medium">Diagnosis *</label><Field id="diagnosis" name="diagnosis" className={input} /><Err name="diagnosis" /></div><div><label htmlFor="validDays" className="mb-1 block text-sm font-medium">Valid for (days)</label><Field id="validDays" name="validDays" type="number" className={input} /><Err name="validDays" /></div><div className="md:col-span-3"><label htmlFor="notes" className="mb-1 block text-sm font-medium">Notes</label><Field as="textarea" id="notes" name="notes" rows={2} className={`${input} h-auto py-2`} /></div></CardBody></Card>
          <Card><CardHeader><CardTitle>Medicines</CardTitle></CardHeader><CardBody><FieldArray name="items">{({ push, remove }) => (<div className="space-y-3">{values.items.map((_, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3 md:grid-cols-12">
              <div className="col-span-2 md:col-span-4"><label className="text-xs text-muted">Medicine *</label><Field as="select" name={`items.${i}.medicineId`} className={input} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFieldValue(`items.${i}.medicineId`, Number(e.target.value))}><option value="">Select…</option>{medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Field><Err name={`items.${i}.medicineId`} /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted">Dosage *</label><Field name={`items.${i}.dosage`} placeholder="500mg" className={input} /><Err name={`items.${i}.dosage`} /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted">Frequency</label><Field as="select" name={`items.${i}.frequency`} className={input}>{['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'At bedtime', 'As needed'].map((f) => <option key={f}>{f}</option>)}</Field></div>
              <div className="md:col-span-1"><label className="text-xs text-muted">Days</label><Field name={`items.${i}.durationDays`} type="number" className={input} /><Err name={`items.${i}.durationDays`} /></div>
              <div className="md:col-span-1"><label className="text-xs text-muted">Qty</label><Field name={`items.${i}.quantity`} type="number" className={input} /><Err name={`items.${i}.quantity`} /></div>
              <div className="col-span-2 flex items-end gap-1 md:col-span-2"><Field name={`items.${i}.instructions`} placeholder="Instructions" aria-label="Instructions" className={input} /><Button type="button" variant="ghost" size="icon" aria-label={`Remove medicine ${i + 1}`} disabled={values.items.length === 1} onClick={() => remove(i)}><Trash2 className="size-4 text-danger" /></Button></div>
            </div>))}{typeof errors.items === 'string' && <p role="alert" className="text-xs text-danger">{errors.items}</p>}<Button type="button" variant="outline" onClick={() => push({ ...blank })}><Plus className="size-4" />Add medicine</Button></div>)}</FieldArray></CardBody></Card>
          <Button type="submit" loading={isSubmitting}>Save prescription</Button>
        </Form>
      )}
    </Formik>
  );
}
