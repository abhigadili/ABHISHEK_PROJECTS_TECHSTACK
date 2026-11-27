import { useMemo, useRef, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Divider, FormControl, FormHelperText, Grid2 as Grid, InputLabel, MenuItem, Select, Step, StepLabel, Stepper, TextField, Typography, CircularProgress, Link } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { useAuth, useAuthActions } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { useCreatePatient } from '../hooks/usePatients';
import { accountSchema } from '@/schemas/auth';
import { contactSchema, emptyPatientForm, personalSchema, type PatientFormValues } from '@/schemas/patient';
import { zodErrors } from '@/utils/zodForm';
import { isApiError, errorMessage } from '@/services/axios/errors';
import { ageFromDob, formatDate, humanize } from '@/utils/format';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/Spinner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Patient } from '@/types';
import { PatientDetailGrid } from '../components/PatientDetailGrid';

/**
 * Scenario 1 - Patient registration (MUI, controlled inputs, plain `useState`, multi-step form).
 *
 *  anonymous visitor  : Account -> Personal -> Contact & medical -> Review
 *                       submit = POST /auth/register  ->  POST /auth/login  ->  POST /patients   (sequential calls)
 *  signed-in PATIENT without a profile, or ADMIN registering someone : Personal -> Contact & medical -> Review
 *                       submit = POST /patients (a PATIENT's profile is bound to their login by the backend)
 *
 * Each step is validated with Zod (field-level on blur/next, cross-field for passwords, conditional for the emergency
 * contact). Backend 400/409 details are mapped back onto the right field and the right step.
 */
type Step = 'account' | 'personal' | 'contact' | 'review';
const STEP_LABEL: Record<Step, string> = { account: 'Account', personal: 'Personal details', contact: 'Contact & medical', review: 'Review' };
const FIELD_STEP: Record<string, Step> = {
  username: 'account', password: 'account', confirmPassword: 'account',
  firstName: 'personal', lastName: 'personal', dateOfBirth: 'personal', gender: 'personal', bloodGroup: 'personal', identityNumber: 'personal',
  email: 'contact', phone: 'contact', address: 'contact', emergencyContactName: 'contact', emergencyContactPhone: 'contact', knownAllergies: 'contact',
};

export default function PatientRegistrationPage() {
  useDocumentTitle('Register patient');
  const { status, role } = useAuth();
  const { login, register } = useAuthActions();
  const own = useCurrentPatient();
  const create = useCreatePatient();
  const navigate = useNavigate();

  // Sticky: once the visitor started as anonymous the account step stays part of the wizard, even after the automatic
  // sign-in in the middle of the submit changes `status` to "authenticated".
  const accountFlow = useRef(false);
  if (status === 'anonymous') accountFlow.current = true;
  const needsAccount = accountFlow.current;
  const steps = useMemo<Step[]>(() => (needsAccount ? ['account', 'personal', 'contact', 'review'] : ['personal', 'contact', 'review']), [needsAccount]);

  // --- plain useState: one piece of state per concern ---
  const [active, setActive] = useState(0);
  const [account, setAccount] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [form, setForm] = useState<PatientFormValues>(emptyPatientForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState<Patient | null>(null);

  if (status === 'loading' || (role === 'PATIENT' && own.isPending)) return <PageLoader />;
  if (role === 'PATIENT' && own.patient && !registered) return <Navigate to="/profile" replace />;
  if (role && role !== 'PATIENT' && role !== 'ADMIN') return <Navigate to="/access-denied" replace state={{ from: '/patients/new' }} />;

  const current = steps[active] as Step;
  const setF = <K extends keyof PatientFormValues>(k: K, v: PatientFormValues[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };
  const setA = (k: keyof typeof account, v: string) => {
    setAccount((a) => ({ ...a, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validateStep = (s: Step): boolean => {
    const errs = s === 'account' ? zodErrors(accountSchema, account) : s === 'personal' ? zodErrors(personalSchema, form) : s === 'contact' ? zodErrors(contactSchema, form) : {};
    setErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  };
  const next = () => validateStep(current) && setActive((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setActive((i) => Math.max(i - 1, 0));

  const goToFirstErrorStep = (fieldErrors: Record<string, string>) => {
    const target = steps.findIndex((s) => Object.keys(fieldErrors).some((f) => FIELD_STEP[f] === s));
    if (target >= 0) setActive(target);
  };

  const submit = async () => {
    // re-validate everything (the user may have jumped back and edited)
    const all = { ...(needsAccount ? zodErrors(accountSchema, account) : {}), ...zodErrors(personalSchema, form), ...zodErrors(contactSchema, form) };
    if (Object.keys(all).length) {
      setErrors(all);
      goToFirstErrorStep(all);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    let stage: 'account' | 'login' | 'profile' = needsAccount ? 'account' : 'profile';
    try {
      if (needsAccount) {
        await register({ username: account.username.trim(), email: account.email.trim(), password: account.password });
        stage = 'login';
        await login({ username: account.username.trim(), password: account.password });
        stage = 'profile';
      }
      const patient = await create.mutateAsync(form);
      setRegistered(patient);
      toast.success('Patient registered');
    } catch (e) {
      if (isApiError(e)) {
        const fe: Record<string, string> = { ...e.fieldErrors };
        if (e.status === 409 && stage === 'account') fe[/e-?mail/i.test(e.message) ? 'email' : 'username'] = e.message;
        if (e.status === 409 && stage === 'profile') fe[/phone/i.test(e.message) ? 'phone' : /identity/i.test(e.message) ? 'identityNumber' : 'email'] = e.message;
        setErrors((prev) => ({ ...prev, ...fe }));
        if (Object.keys(fe).length) goToFirstErrorStep(fe);
      }
      setFormError(stage === 'profile' && needsAccount ? `Your account was created and you are signed in, but the patient profile could not be saved: ${errorMessage(e)} Fix the details and submit again.` : errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- success -------------------------------- */
  if (registered) {
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <PageHeader title="Registration complete" subtitle="The patient was saved by the Patient Service" />
        <Alert severity="success" sx={{ mb: 2 }}>{registered.firstName} {registered.lastName} is registered as patient #{registered.id}.</Alert>
        <Card variant="outlined"><CardContent><PatientDetailGrid patient={registered} /></CardContent></Card>
        <Box sx={{ mt: 3, display: 'flex', gap: 1.5 }}>
          <Button variant="contained" onClick={() => navigate(role === 'ADMIN' ? `/patients/${registered.id}` : '/profile', { replace: true })}>Open patient profile</Button>
          {role === 'ADMIN' && <Button variant="outlined" onClick={() => { setRegistered(null); setForm(emptyPatientForm); setErrors({}); setActive(0); }}>Register another</Button>}
        </Box>
      </Box>
    );
  }

  const err = (k: string) => ({ error: !!errors[k], helperText: errors[k] || undefined });

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <PageHeader title={needsAccount ? 'Create your patient account' : 'Register patient'} subtitle={needsAccount ? 'Create a login and your patient profile in one go' : role === 'ADMIN' ? 'Register a patient on their behalf' : 'Complete your patient profile'} />
      <Stepper activeStep={active} alternativeLabel sx={{ mb: 3 }}>
        {steps.map((s) => <Step key={s}><StepLabel>{STEP_LABEL[s]}</StepLabel></Step>)}
      </Stepper>
      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); if (current === 'review') void submit(); else next(); }} aria-label={`${STEP_LABEL[current]} step`}>
            {current === 'account' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Username" autoComplete="username" value={account.username} onChange={(e) => setA('username', e.target.value)} {...err('username')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Account e-mail" type="email" autoComplete="email" value={account.email} onChange={(e) => setA('email', e.target.value)} {...err('email')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Password" type="password" autoComplete="new-password" value={account.password} onChange={(e) => setA('password', e.target.value)} {...err('password')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Confirm password" type="password" autoComplete="new-password" value={account.confirmPassword} onChange={(e) => setA('confirmPassword', e.target.value)} {...err('confirmPassword')} /></Grid>
                <Grid size={12}><Typography variant="caption" color="text.secondary">8-72 characters with an uppercase letter, a lowercase letter and a digit.</Typography></Grid>
              </Grid>
            )}
            {current === 'personal' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="First name" value={form.firstName} onChange={(e) => setF('firstName', e.target.value)} {...err('firstName')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Last name" value={form.lastName} onChange={(e) => setF('lastName', e.target.value)} {...err('lastName')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DatePicker
                    label="Date of birth"
                    disableFuture
                    value={form.dateOfBirth ? dayjs(form.dateOfBirth) : null}
                    onChange={(d) => setF('dateOfBirth', d && d.isValid() ? d.format('YYYY-MM-DD') : '')}
                    slotProps={{ textField: { fullWidth: true, required: true, error: !!errors.dateOfBirth, helperText: errors.dateOfBirth } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth required error={!!errors.gender}>
                    <InputLabel id="gender-l">Gender</InputLabel>
                    <Select labelId="gender-l" label="Gender" value={form.gender} onChange={(e) => setF('gender', e.target.value as PatientFormValues['gender'])}>
                      {(['FEMALE', 'MALE', 'OTHER'] as const).map((g) => <MenuItem key={g} value={g}>{humanize(g)}</MenuItem>)}
                    </Select>
                    {errors.gender && <FormHelperText>{errors.gender}</FormHelperText>}
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="bg-l">Blood group</InputLabel>
                    <Select labelId="bg-l" label="Blood group" value={form.bloodGroup} onChange={(e) => setF('bloodGroup', e.target.value as PatientFormValues['bloodGroup'])}>
                      <MenuItem value="">Unknown</MenuItem>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Identity number (optional)" value={form.identityNumber} onChange={(e) => setF('identityNumber', e.target.value)} {...err('identityNumber')} /></Grid>
              </Grid>
            )}
            {current === 'contact' && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="E-mail" type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} {...err('email')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Mobile phone" placeholder="+919876543210" value={form.phone} onChange={(e) => setF('phone', e.target.value)} {...err('phone')} /></Grid>
                <Grid size={12}><TextField fullWidth multiline minRows={2} label="Address" value={form.address} onChange={(e) => setF('address', e.target.value)} {...err('address')} /></Grid>
                <Grid size={12}><Divider><Typography variant="caption">Emergency contact</Typography></Divider></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Contact name" value={form.emergencyContactName} onChange={(e) => setF('emergencyContactName', e.target.value)} {...err('emergencyContactName')} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Contact phone" value={form.emergencyContactPhone} onChange={(e) => setF('emergencyContactPhone', e.target.value)} {...err('emergencyContactPhone')} /></Grid>
                <Grid size={12}><TextField fullWidth multiline minRows={2} label="Known allergies" placeholder="e.g. Penicillin" value={form.knownAllergies} onChange={(e) => setF('knownAllergies', e.target.value)} {...err('knownAllergies')} /></Grid>
              </Grid>
            )}
            {current === 'review' && (
              <Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Please confirm the details</Typography>
                {needsAccount && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Login: <b>{account.username}</b> ({account.email})</Typography>}
                <PatientDetailGrid patient={{ ...form, id: 0, status: 'ACTIVE', age: ageFromDob(form.dateOfBirth) }} preview />
              </Box>
            )}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>{needsAccount && active === 0 && <Typography variant="body2">Already registered? <Link component={RouterLink} to="/login">Sign in</Link></Typography>}</Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={back} disabled={active === 0 || submitting}>Back</Button>
                <Button type="submit" variant="contained" disabled={submitting} startIcon={submitting ? <CircularProgress size={16} /> : undefined}>
                  {current === 'review' ? (submitting ? 'Registering…' : 'Register') : 'Next'}
                </Button>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Date of birth is shown as {form.dateOfBirth ? formatDate(form.dateOfBirth) : 'dd Mon yyyy'}.</Typography>
    </Box>
  );
}
