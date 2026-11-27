'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Grid, Paper, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { RhfDate, RhfSelect, RhfTextField } from '@/components/forms/RhfFields';
import { registerPatientAction } from '@/actions/patients';
import { emptyPatientForm, patientFormSchema, type PatientFormValues } from '@/schemas/patient';
import { emitToast } from '@/components/ui/toast';
import { humanize } from '@/lib/utilities/format';

const STEPS = ['Personal details', 'Contact & emergency', 'Review & register'] as const;
const STEP_FIELDS: (keyof PatientFormValues)[][] = [
  ['firstName', 'lastName', 'dateOfBirth', 'gender', 'bloodGroup', 'identityNumber'],
  ['email', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'knownAllergies'],
  [],
];
const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v || 'Unknown' }));

/**
 * Scenario 1 - Patient registration: multi-step React Hook Form + Zod (client validation), final submit calls a Server Action that
 * validates again on the server. Server field errors are mapped back onto the form with setError().
 */
export function PatientRegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, trigger, setError, reset, formState: { isDirty } } = useForm<PatientFormValues>({ resolver: zodResolver(patientFormSchema), defaultValues: emptyPatientForm, mode: 'onTouched' });
  const values = useWatch({ control }) as PatientFormValues; // live values for the review step

  const next = async () => { if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1); };
  const submit = handleSubmit((data) => {
    setFormError(null);
    startTransition(async () => {
      const res = await registerPatientAction(data);
      if (res.ok && res.data) { emitToast({ kind: 'success', text: res.message ?? 'Patient registered' }); router.push(`/patients/${res.data.id}`); return; }
      setFormError(res.message ?? 'Registration failed');
      for (const [k, m] of Object.entries(res.fieldErrors ?? {})) { setError(k as keyof PatientFormValues, { message: m }); const s = STEP_FIELDS.findIndex((f) => f.includes(k as keyof PatientFormValues)); if (s >= 0) setStep(s); }
    });
  });

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 860 }}>
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>{STEPS.map((l) => <Step key={l}><StepLabel>{l}</StepLabel></Step>)}</Stepper>
      {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
      <form onSubmit={submit} noValidate>
        {step === 0 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="firstName" label="First name" required autoFocus /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="lastName" label="Last name" required /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfDate control={control} name="dateOfBirth" label="Date of birth" required maxToday /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfSelect control={control} name="gender" label="Gender" required options={['FEMALE', 'MALE', 'OTHER'].map((g) => ({ value: g, label: humanize(g) }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfSelect control={control} name="bloodGroup" label="Blood group" options={BLOOD} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="identityNumber" label="Identity number (optional)" /></Grid>
          </Grid>
        )}
        {step === 1 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="email" label="E-mail" type="email" required /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="phone" label="Phone" required helperText="7-15 digits, optional +" /></Grid>
            <Grid size={12}><RhfTextField control={control} name="address" label="Address" multiline minRows={2} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="emergencyContactName" label="Emergency contact name" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="emergencyContactPhone" label="Emergency contact phone" /></Grid>
            <Grid size={12}><RhfTextField control={control} name="knownAllergies" label="Known allergies" multiline minRows={2} /></Grid>
          </Grid>
        )}
        {step === 2 && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>Please check your details</Typography>
            <Grid container spacing={1}>
              {Object.entries(values).filter(([, v]) => v).map(([k, v]) => <Grid key={k} size={{ xs: 12, sm: 6 }}><Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</Typography><Typography>{String(v)}</Typography></Grid>)}
            </Grid>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>Back</Button>
            <Button color="inherit" disabled={!isDirty || pending} onClick={() => { reset(); setStep(0); setFormError(null); }}>Reset</Button>
          </Box>
          {step < STEPS.length - 1 ? <Button key="next" type="button" variant="contained" onClick={next}>Next</Button> : <Button key="submit" type="submit" variant="contained" disabled={pending}>{pending ? 'Registering…' : 'Register patient'}</Button>}
        </Box>
      </form>
    </Paper>
  );
}
