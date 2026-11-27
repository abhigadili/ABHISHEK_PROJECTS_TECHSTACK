'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Grid, Paper, TextField } from '@mui/material';
import { updatePatientAction } from '@/actions/patients';
import { SubmitButton } from '@/features/SubmitButton';
import { emitToast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/actions/state';
import type { Patient } from '@/types';

/**
 * Uncontrolled MUI inputs (defaultValue + name) posted as FormData to a Server Action through useActionState.
 * Because it is a real <form action>, the update also works before JavaScript has loaded (progressive enhancement).
 */
export function PatientEditForm({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState<Patient>, FormData>(updatePatientAction, { ok: false });
  useEffect(() => { if (state.ok) { emitToast({ kind: 'success', text: state.message ?? 'Saved' }); router.push(`/patients/${patient.id}`); } }, [state, router, patient.id]);
  const e = state.fieldErrors ?? {};
  const f = (name: string, label: string, def: string | null, extra: object = {}) => <Grid size={{ xs: 12, sm: 6 }}><TextField name={name} label={label} defaultValue={def ?? ''} error={!!e[name]} helperText={e[name]} {...extra} /></Grid>;
  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 860 }}>
      <form action={action} noValidate>
        <input type="hidden" name="id" value={patient.id} />
        {state.message && !state.ok && <Alert severity="error" sx={{ mb: 2 }}>{state.message}</Alert>}
        <Grid container spacing={2}>
          {f('firstName', 'First name', patient.firstName, { required: true })}{f('lastName', 'Last name', patient.lastName, { required: true })}
          {f('dateOfBirth', 'Date of birth (YYYY-MM-DD)', patient.dateOfBirth, { required: true })}
          <Grid size={{ xs: 12, sm: 6 }}><TextField select name="gender" label="Gender" defaultValue={patient.gender} slotProps={{ select: { native: true } }}><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></TextField></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField select name="bloodGroup" label="Blood group" defaultValue={patient.bloodGroup ?? ''} slotProps={{ select: { native: true } }}>{['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b || 'Unknown'}</option>)}</TextField></Grid>
          {f('identityNumber', 'Identity number', patient.identityNumber)}{f('email', 'E-mail', patient.email, { required: true, type: 'email' })}{f('phone', 'Phone', patient.phone, { required: true })}
          <Grid size={12}><TextField name="address" label="Address" defaultValue={patient.address ?? ''} multiline minRows={2} error={!!e.address} helperText={e.address} /></Grid>
          {f('emergencyContactName', 'Emergency contact name', patient.emergencyContactName)}{f('emergencyContactPhone', 'Emergency contact phone', patient.emergencyContactPhone)}
          <Grid size={12}><TextField name="knownAllergies" label="Known allergies" defaultValue={patient.knownAllergies ?? ''} multiline minRows={2} /></Grid>
        </Grid>
        <div className="mt-4 flex gap-2"><SubmitButton pendingText="Saving…">Save changes</SubmitButton></div>
      </form>
    </Paper>
  );
}
