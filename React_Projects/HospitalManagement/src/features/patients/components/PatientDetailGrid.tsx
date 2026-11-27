import { Grid2 as Grid, Typography, Box } from '@mui/material';
import { ageFromDob, formatDate, formatDateTime, humanize } from '@/utils/format';
import type { Patient } from '@/types';

type Shown = Pick<Patient, 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'email' | 'phone'> & Partial<Pick<Patient, 'id' | 'identityNumber' | 'address' | 'emergencyContactName' | 'emergencyContactPhone' | 'knownAllergies' | 'createdAt' | 'status'>> & { bloodGroup?: string | null; age?: number | null };

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{children === undefined || children === null || children === '' ? '—' : children}</Typography>
    </Box>
  );
}

/** Read-only patient facts (MUI Grid) used by the registration review/success view, the details page and the profile page. */
export function PatientDetailGrid({ patient: p, preview }: { patient: Shown; preview?: boolean }) {
  return (
    <Grid container spacing={2.5}>
      {!preview && p.id ? <Grid size={{ xs: 6, sm: 4 }}><Field label="Patient ID">#{p.id}</Field></Grid> : null}
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Name">{p.firstName} {p.lastName}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Date of birth">{formatDate(p.dateOfBirth)} ({ageFromDob(p.dateOfBirth) ?? '—'} y)</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Gender">{humanize(p.gender)}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Blood group">{p.bloodGroup}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Identity number">{p.identityNumber}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="E-mail">{p.email}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Phone">{p.phone}</Field></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><Field label="Address">{p.address}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Emergency contact">{p.emergencyContactName}</Field></Grid>
      <Grid size={{ xs: 6, sm: 4 }}><Field label="Emergency phone">{p.emergencyContactPhone}</Field></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><Field label="Known allergies">{p.knownAllergies}</Field></Grid>
      {!preview && p.createdAt ? <Grid size={{ xs: 6, sm: 4 }}><Field label="Registered">{formatDateTime(p.createdAt)}</Field></Grid> : null}
      {!preview && p.status ? <Grid size={{ xs: 6, sm: 4 }}><Field label="Status">{humanize(p.status)}</Field></Grid> : null}
    </Grid>
  );
}
