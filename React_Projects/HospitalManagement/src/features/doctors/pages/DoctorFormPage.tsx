import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, type FormikErrors } from 'formik';
import { Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, Collapse, Divider, FormControlLabel, Grid2 as Grid, MenuItem, TextField, Typography } from '@mui/material';
import toast from 'react-hot-toast';
import { doctorYupSchema, type DoctorFormValues } from '@/schemas/doctor';
import { useDoctor, useSaveDoctor } from '../hooks/useDoctors';
import { useDepartments, useHospitals } from '@/features/hospitals/hooks/useHospitals';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { emptyToNull } from '@/utils/format';
import { errorMessage, isApiError } from '@/services/axios/errors';
import type { Doctor } from '@/types';

const blank: DoctorFormValues = { firstName: '', lastName: '', email: '', phone: '', licenseNumber: '', specialization: '', qualification: '', experienceYears: null, consultationFee: 500, hospitalId: 0, departmentId: null, createLogin: false, username: '', password: '' };
const fromDoctor = (d: Doctor): DoctorFormValues => ({ ...blank, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone ?? '', licenseNumber: d.licenseNumber, specialization: d.specialization, qualification: d.qualification ?? '', experienceYears: d.experienceYears, consultationFee: d.consultationFee, hospitalId: d.hospitalId, departmentId: d.departmentId });

/** Doctor registration / edit (MUI + Formik + Yup, conditional "create login" section → two sequential API calls). */
export default function DoctorFormPage() {
  const { doctorId } = useParams();
  const editing = doctorId !== undefined;
  const id = Number(doctorId);
  const navigate = useNavigate();
  const query = useDoctor(editing ? id : 0);
  if (editing) return <QueryBoundary query={query}>{(d) => <DoctorForm doctor={d} onDone={() => navigate(`/doctors/${d.id}`)} />}</QueryBoundary>;
  return <DoctorForm onDone={(d) => navigate(`/doctors/${d.id}`)} />;
}

function DoctorForm({ doctor, onDone }: { doctor?: Doctor; onDone: (d: Doctor) => void }) {
  const save = useSaveDoctor(doctor?.id);
  const hospitals = useHospitals();
  const initial = useMemo(() => (doctor ? fromDoctor(doctor) : blank), [doctor]);
  return (
    <Box sx={{ maxWidth: 860 }}>
      <PageHeader title={doctor ? `Edit ${doctor.fullName}` : 'Register doctor'} subtitle="Doctor Service" />
      <Formik<DoctorFormValues>
        initialValues={initial}
        enableReinitialize
        validationSchema={doctorYupSchema}
        onSubmit={async (v, { setErrors, setStatus }) => {
          setStatus(undefined);
          try {
            const saved = await save.mutateAsync({
              firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), phone: emptyToNull(v.phone), licenseNumber: v.licenseNumber.trim(), specialization: v.specialization.trim(),
              qualification: emptyToNull(v.qualification), experienceYears: v.experienceYears ?? null, consultationFee: Number(v.consultationFee), hospitalId: Number(v.hospitalId), departmentId: v.departmentId ? Number(v.departmentId) : null,
              userId: doctor?.userId ?? null,
              createLogin: !doctor && v.createLogin ? { username: v.username!, password: v.password! } : undefined,
            });
            toast.success(doctor ? 'Doctor updated' : 'Doctor registered');
            onDone(saved);
          } catch (e) {
            if (isApiError(e)) setErrors(e.fieldErrors as FormikErrors<DoctorFormValues>);
            setStatus(errorMessage(e));
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status, dirty, setFieldValue }) => <DoctorFormBody {...{ values, errors, touched, handleChange, handleBlur, isSubmitting, status, dirty, setFieldValue }} editing={!!doctor} hospitalsLoading={hospitals.isPending} hospitalOptions={hospitals.data ?? []} />}
      </Formik>
    </Box>
  );
}

type FormikLike = Pick<import('formik').FormikProps<DoctorFormValues>, 'values' | 'errors' | 'touched' | 'handleChange' | 'handleBlur' | 'isSubmitting' | 'status' | 'dirty' | 'setFieldValue'>;

function DoctorFormBody({ values, errors, touched, handleChange, handleBlur, isSubmitting, status, dirty, setFieldValue, editing, hospitalOptions, hospitalsLoading }: FormikLike & { editing: boolean; hospitalOptions: { id: number; name: string }[]; hospitalsLoading: boolean }) {
  const navigate = useNavigate();
  const departments = useDepartments(values.hospitalId ? Number(values.hospitalId) : null); // dependent query
  const f = (name: keyof DoctorFormValues, label: string, extra: object = {}) => (
    <TextField fullWidth name={name} label={label} value={values[name] ?? ''} onChange={handleChange} onBlur={handleBlur} error={!!(touched[name] && errors[name])} helperText={touched[name] && errors[name] ? String(errors[name]) : undefined} {...extra} />
  );
  return (
    <Form noValidate aria-label={editing ? 'Edit doctor' : 'Register doctor'}>
      <Card variant="outlined"><CardContent sx={{ p: 3 }}>
        {status && <Alert severity="error" sx={{ mb: 2 }}>{status}</Alert>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>{f('firstName', 'First name', { required: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('lastName', 'Last name', { required: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('email', 'E-mail', { type: 'email', required: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('phone', 'Phone')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('licenseNumber', 'Licence number', { required: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('specialization', 'Specialization', { required: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('qualification', 'Qualification')}</Grid>
          <Grid size={{ xs: 6, sm: 3 }}>{f('experienceYears', 'Experience (years)', { type: 'number' })}</Grid>
          <Grid size={{ xs: 6, sm: 3 }}>{f('consultationFee', 'Consultation fee (INR)', { type: 'number', required: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('hospitalId', 'Hospital', { select: true, required: true, disabled: hospitalsLoading, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { handleChange(e); void setFieldValue('departmentId', null); }, children: [<MenuItem key={0} value={0} disabled>Select hospital</MenuItem>, ...hospitalOptions.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)] })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('departmentId', 'Department', { select: true, disabled: !values.hospitalId || departments.isPending, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void setFieldValue('departmentId', e.target.value === '' ? null : Number(e.target.value)), children: [<MenuItem key="n" value="">None</MenuItem>, ...(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)] })}</Grid>
        </Grid>
        {!editing && (
          <>
            <Divider sx={{ my: 3 }} />
            <FormControlLabel control={<Checkbox name="createLogin" checked={!!values.createLogin} onChange={handleChange} />} label="Also create a login for this doctor (role DOCTOR)" />
            <Collapse in={!!values.createLogin}>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>{f('username', 'Username')}</Grid>
                <Grid size={{ xs: 12, sm: 6 }}>{f('password', 'Initial password', { type: 'password' })}</Grid>
                <Grid size={12}><Typography variant="caption" color="text.secondary">Sequential calls: POST /users creates the account, then POST /doctors links it with its user id.</Typography></Grid>
              </Grid>
            </Collapse>
          </>
        )}
        <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || (!dirty && editing)} startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}>{editing ? 'Save changes' : 'Register doctor'}</Button>
        </Box>
      </CardContent></Card>
    </Form>
  );
}
