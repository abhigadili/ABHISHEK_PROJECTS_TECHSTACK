'use client';
import { useActionState, useEffect } from 'react';
import { updatePatientProfileAction } from './actions';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/components/common/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import type { ActionState } from '@/server/http/action';
export interface ProfileValues { firstName: string; lastName: string; phone: string; dateOfBirth: string; gender: string; bloodGroup: string; address: string; city: string; emergencyContactName: string; emergencyContactPhone: string; medicalHistory: string }
/** Uncontrolled inputs (`defaultValue`) posted as FormData to a Server Action via useActionState - works without JavaScript. */
export function PatientProfileForm({ patientId, v }: { patientId: number; v: ProfileValues }) {
  const [s, action] = useActionState<ActionState, FormData>(updatePatientProfileAction.bind(null, patientId), { ok: false });
  useEffect(() => { if (s.ok) emitToast({ kind: 'success', text: s.message ?? 'Saved' }); }, [s]);
  const e = s.fieldErrors ?? {};
  const f = (n: keyof ProfileValues, l: string, type = 'text') => <Field label={l} htmlFor={n} error={e[n]}><Input id={n} name={n} type={type} defaultValue={v[n]} aria-invalid={!!e[n]} /></Field>;
  return <form action={action} className="grid gap-4 md:grid-cols-2" noValidate>{s.message && !s.ok && !Object.keys(e).length && <div className="md:col-span-2"><Alert tone="danger">{s.message}</Alert></div>}{f('firstName', 'First name')}{f('lastName', 'Last name')}{f('phone', 'Phone')}{f('dateOfBirth', 'Date of birth', 'date')}<Field label="Gender" htmlFor="gender"><NativeSelect id="gender" name="gender" defaultValue={v.gender}><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></NativeSelect></Field><Field label="Blood group" htmlFor="bloodGroup"><NativeSelect id="bloodGroup" name="bloodGroup" defaultValue={v.bloodGroup}>{['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b || 'Unknown'}</option>)}</NativeSelect></Field>{f('address', 'Address')}{f('city', 'City')}{f('emergencyContactName', 'Emergency contact name')}{f('emergencyContactPhone', 'Emergency contact phone')}<div className="md:col-span-2"><Field label="Medical history (self-reported)" htmlFor="medicalHistory" error={e.medicalHistory}><Textarea id="medicalHistory" name="medicalHistory" rows={4} defaultValue={v.medicalHistory} /></Field></div><div className="md:col-span-2"><SubmitButton pendingText="Saving…">Save profile</SubmitButton></div></form>;
}
