import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FieldArray, Form, Formik, type FormikErrors, type FormikHelpers } from 'formik';
import { FilePlus2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { prescriptionSchema, emptyItem, FREQUENCIES, type PrescriptionFormValues } from '@/schemas/prescription';
import { zodToFormikValidate } from '@/utils/zodForm';
import { useCreatePrescription, useMedicineSuggestions } from '../hooks/usePrescriptions';
import { usePrescriptionExport } from '../hooks/usePrescriptionExport';
import { PrescriptionView } from '../components/PrescriptionView';
import { FormikInput, FormikSelect, FormikTextarea } from '@/components/forms/FormikFields';
import { PatientPicker } from '@/components/common/PatientPicker';
import { PageHeader } from '@/components/common/PageHeader';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentDoctor } from '@/features/authentication/hooks/useCurrentIdentity';
import { useDoctorList } from '@/features/doctors/hooks/useDoctors';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { errorMessage, isApiError } from '@/services/axios/errors';
import { emptyToNull, formatDate, ageFromDob } from '@/utils/format';
import type { Patient, Prescription } from '@/types';

/**
 * Scenario 5 - Prescription generation (Tailwind/Formik/Zod).
 *  1 search + select the patient (debounced search)       2 retrieve patient information (allergies shown while prescribing)
 *  3 diagnosis and prescription details                   4 add multiple medicines dynamically (Formik FieldArray)
 *  5 medicine/dosage validation (Zod, incl. duplicate check) 6 POST /prescriptions   7 show the generated prescription (compound component)
 *  8 print / download
 */
export default function GeneratePrescriptionPage() {
  const [params] = useSearchParams();
  const { role } = useAuth();
  const own = useCurrentDoctor();
  const doctors = useDoctorList({ active: true, size: 100 });
  const create = useCreatePrescription();
  const suggestions = useMedicineSuggestions();
  const { download, print, busy } = usePrescriptionExport();
  const [result, setResult] = useState<Prescription | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const preId = Number(params.get('patientId')) || 0;
  const preloaded = usePatient(preId, preId > 0 && !patient);
  const activePatient = patient ?? preloaded.data ?? null;
  const patientInfo = usePatient(activePatient?.id ?? 0, !!activePatient); // retrieved details (fresh, cached)

  const initial = useMemo<PrescriptionFormValues>(() => ({
    patientId: activePatient?.id as number, doctorId: (role === 'DOCTOR' ? own.doctor?.id : Number(params.get('doctorId')) || undefined) as number,
    appointmentId: Number(params.get('appointmentId')) || null, diagnosis: '', notes: '', validDays: 30, items: [{ ...emptyItem }],
  }), [activePatient?.id, role, own.doctor?.id, params]);

  if (result) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="Prescription generated" subtitle="Saved by the Prescription Service" icon={<FilePlus2 className="h-5 w-5" />} />
        <div id="rx-print">
          <PrescriptionView prescription={result}>
            <PrescriptionView.Header />
            <PrescriptionView.Parties />
            <PrescriptionView.Diagnosis />
            <PrescriptionView.Items />
            <PrescriptionView.Footer>
              <Button asChild><Link to={`/prescriptions/${result.id}`}>Open prescription</Link></Button>
              <Button variant="outline" disabled={busy} onClick={() => void print(result)}>Print</Button>
              <Button variant="outline" disabled={busy} onClick={() => void download(result)}>Download</Button>
              <Button variant="ghost" onClick={() => setResult(null)}>Write another</Button>
            </PrescriptionView.Footer>
          </PrescriptionView>
        </div>
        <Notice>The pharmacy receives this prescription automatically (Kafka) and creates a pharmacy order; the patient's medical record gets a timeline entry and a notification is queued.</Notice>
      </div>
    );
  }

  const submit = async (v: PrescriptionFormValues, h: FormikHelpers<PrescriptionFormValues>) => {
    h.setStatus(undefined);
    try {
      const p = await create.mutateAsync({
        patientId: v.patientId, doctorId: v.doctorId, appointmentId: v.appointmentId ?? null, diagnosis: emptyToNull(v.diagnosis), notes: emptyToNull(v.notes), validDays: Number(v.validDays),
        items: v.items.map((i) => ({ medicineName: i.medicineName.trim(), dosage: i.dosage.trim(), frequency: i.frequency.trim(), durationDays: Number(i.durationDays), quantity: Number(i.quantity), instructions: emptyToNull(i.instructions) })),
      });
      toast.success('Prescription saved');
      setResult(p);
    } catch (e) {
      if (isApiError(e)) h.setErrors(e.fieldErrors as FormikErrors<PrescriptionFormValues>);
      h.setStatus(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Generate prescription" subtitle="Diagnosis and medicines for a patient" icon={<FilePlus2 className="h-5 w-5" />} />
      {role === 'DOCTOR' && !own.isPending && !own.doctor && <Notice tone="warning" title="No doctor profile">Your login is not linked to a doctor profile, so prescriptions cannot be issued under your name. Ask an administrator to link it.</Notice>}
      <Formik<PrescriptionFormValues> initialValues={initial} enableReinitialize validate={zodToFormikValidate(prescriptionSchema)} onSubmit={submit}>
        {({ values, errors, touched, setFieldValue, setFieldTouched, isSubmitting, status, submitCount }) => (
          <Form noValidate className="space-y-4" aria-label="Prescription form">
            {status && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{status}</div>}
            <Card className="space-y-4 p-5">
              <h2 className="font-semibold">1 · Patient & doctor</h2>
              <PatientPicker value={activePatient} onChange={(p) => { setPatient(p); void setFieldValue('patientId', p?.id); void setFieldTouched('patientId', true, false); }} error={(touched.patientId || submitCount > 0) && errors.patientId ? String(errors.patientId) : undefined} />
              {patientInfo.data && (
                <div className="grid gap-2 rounded-lg bg-surface-alt p-3 text-sm sm:grid-cols-4"><div><span className="block text-xs text-muted">Age / gender</span>{ageFromDob(patientInfo.data.dateOfBirth)} y · {patientInfo.data.gender.toLowerCase()}</div><div><span className="block text-xs text-muted">Blood group</span>{patientInfo.data.bloodGroup ?? '—'}</div><div className="sm:col-span-2"><span className="block text-xs text-muted">Known allergies</span><span className={patientInfo.data.knownAllergies ? 'font-semibold text-amber-700 dark:text-amber-300' : ''}>{patientInfo.data.knownAllergies ?? 'none recorded'}</span></div></div>
              )}
              {role === 'DOCTOR' ? <p className="text-sm text-muted">Prescribing as <b>{own.doctor?.fullName ?? '…'}</b></p> : (
                <FormikSelect name="doctorId" label="Prescribing doctor" options={[{ value: '', label: 'Select a doctor' }, ...(doctors.data?.content ?? []).map((d) => ({ value: d.id, label: `${d.fullName} — ${d.specialization}` }))]} onChange={(e) => void setFieldValue('doctorId', e.target.value ? Number(e.target.value) : undefined)} value={values.doctorId ?? ''} />
              )}
              {values.appointmentId ? <p className="text-xs text-muted">Linked to appointment #{values.appointmentId}</p> : null}
            </Card>

            <Card className="space-y-4 p-5">
              <h2 className="font-semibold">2 · Diagnosis</h2>
              <FormikInput name="diagnosis" label="Diagnosis" placeholder="e.g. Mild anaemia" />
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]"><FormikTextarea name="notes" label="Notes for the patient / pharmacist (optional)" rows={2} /><FormikInput name="validDays" label="Valid for (days)" type="number" min={1} max={365} /></div>
            </Card>

            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between"><h2 className="font-semibold">3 · Medicines</h2><span className="text-xs text-muted">{values.items.length} added</span></div>
              <datalist id="medicine-suggestions">{suggestions.data?.map((m) => <option key={m.id} value={m.name.replace(/\s+\d.*$/, '')}>{m.name}</option>)}</datalist>
              <FieldArray name="items">
                {({ push, remove }) => (
                  <div className="space-y-3">
                    {values.items.map((_, i) => (
                      <div key={i} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-6" data-testid={`rx-item-${i}`}>
                        <FormikInput name={`items.${i}.medicineName`} label="Medicine" list="medicine-suggestions" className="sm:col-span-2" />
                        <FormikInput name={`items.${i}.dosage`} label="Dosage" placeholder="500mg" />
                        <FormikSelect name={`items.${i}.frequency`} label="Frequency" options={FREQUENCIES.map((f) => ({ value: f, label: f }))} />
                        <FormikInput name={`items.${i}.durationDays`} label="Days" type="number" min={1} />
                        <FormikInput name={`items.${i}.quantity`} label="Qty" type="number" min={1} />
                        <FormikInput name={`items.${i}.instructions`} label="Instructions (optional)" placeholder="after food" className="sm:col-span-5" />
                        <div className="flex items-end justify-end"><Button type="button" variant="ghost" size="icon" aria-label={`Remove medicine ${i + 1}`} disabled={values.items.length === 1} onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>
                      </div>
                    ))}
                    {typeof errors.items === 'string' && <p role="alert" className="text-xs text-red-600">{errors.items}</p>}
                    <Button type="button" variant="outline" onClick={() => push({ ...emptyItem })}><Plus className="h-4 w-4" /> Add another medicine</Button>
                  </div>
                )}
              </FieldArray>
            </Card>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" asChild><Link to="/prescriptions">Cancel</Link></Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Generate prescription'}</Button></div>
            {patientInfo.data && <p className="text-center text-xs text-muted">Patient registered {formatDate(patientInfo.data.createdAt)} · #{patientInfo.data.id}</p>}
          </Form>
        )}
      </Formik>
    </div>
  );
}
