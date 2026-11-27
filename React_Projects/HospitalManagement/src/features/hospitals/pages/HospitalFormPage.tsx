import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid2 as Grid, TextField } from '@mui/material';
import toast from 'react-hot-toast';
import { useHospital, useSaveHospital } from '../hooks/useHospitals';
import { validateHospital, type HospitalFormValues } from '@/schemas/hospital';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { errorMessage, isApiError } from '@/services/axios/errors';
import type { Hospital } from '@/types';

const blank: HospitalFormValues = { name: '', code: '', address: '', city: '', phone: '', email: '' };

/** Hospital registration/update (MUI, controlled state + hand-written validation functions, field-level on blur and form-level on submit). */
export default function HospitalFormPage() {
  const { hospitalId } = useParams();
  const id = hospitalId ? Number(hospitalId) : null;
  const query = useHospital(id);
  if (id) return <QueryBoundary query={query}>{(h) => <HospitalForm hospital={h} />}</QueryBoundary>;
  return <HospitalForm />;
}

function HospitalForm({ hospital }: { hospital?: Hospital }) {
  const navigate = useNavigate();
  const save = useSaveHospital(hospital?.id);
  const [v, setV] = useState<HospitalFormValues>(hospital ? { name: hospital.name, code: hospital.code, address: hospital.address ?? '', city: hospital.city ?? '', phone: hospital.phone ?? '', email: hospital.email ?? '' } : blank);
  const [errors, setErrors] = useState<Partial<Record<keyof HospitalFormValues, string>>>({});
  const [error, setError] = useState<string | null>(null);

  const field = (k: keyof HospitalFormValues, label: string, extra: object = {}) => (
    <TextField fullWidth label={label} value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} onBlur={() => setErrors((s) => ({ ...s, [k]: validateHospital(v)[k] }))} error={!!errors[k]} helperText={errors[k]} {...extra} />
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateHospital(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    try {
      const body = { name: v.name.trim(), code: v.code.trim(), ...(v.address.trim() && { address: v.address.trim() }), ...(v.city.trim() && { city: v.city.trim() }), ...(v.phone.trim() && { phone: v.phone.trim() }), ...(v.email.trim() && { email: v.email.trim() }) };
      const saved = await save.mutateAsync(body);
      toast.success(hospital ? 'Hospital updated' : 'Hospital registered');
      navigate(`/hospitals/${saved.id}`);
    } catch (err) {
      if (isApiError(err)) setErrors((s) => ({ ...s, ...(err.fieldErrors as object), ...(err.status === 409 ? { code: err.message } : {}) }));
      setError(errorMessage(err));
    }
  };
  return (
    <Box sx={{ maxWidth: 760 }}>
      <PageHeader title={hospital ? `Edit ${hospital.name}` : 'Register hospital'} subtitle="Hospital Service" />
      <Card variant="outlined"><CardContent sx={{ p: 3 }}>
        <Box component="form" noValidate onSubmit={submit} aria-label="Hospital form">
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>{field('name', 'Hospital name', { required: true })}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{field('code', 'Code', { required: true })}</Grid>
            <Grid size={12}>{field('address', 'Address')}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{field('city', 'City')}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{field('phone', 'Phone')}</Grid>
            <Grid size={{ xs: 12, sm: 4 }}>{field('email', 'E-mail', { type: 'email' })}</Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending} startIcon={save.isPending ? <CircularProgress size={16} /> : undefined}>{hospital ? 'Save changes' : 'Register hospital'}</Button>
          </Box>
        </Box>
      </CardContent></Card>
    </Box>
  );
}
