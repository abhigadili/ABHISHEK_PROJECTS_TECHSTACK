import { useNavigate, useParams } from 'react-router-dom';
import { Formik, Form, type FormikErrors } from 'formik';
import { Alert, Box, Button, Card, CardContent, Grid2 as Grid, MenuItem, TextField, Typography, CircularProgress, Divider } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { fromPatient, usePatient, useUpdatePatient } from '../hooks/usePatients';
import { patientFormSchema, type PatientFormValues } from '@/schemas/patient';
import { zodToFormikValidate } from '@/utils/zodForm';
import { isApiError, errorMessage } from '@/services/axios/errors';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { humanize } from '@/utils/format';

/**
 * Patient edit (MUI): Formik + Zod. `validate` is a thin adapter over the Zod schema (field-level feedback via
 * touched/errors, form-level via cross-field refine), `enableReinitialize` resets the form when fresh server data
 * arrives, and backend 400 `details` are pushed back with `setErrors` (server-side validation errors).
 */
export default function PatientEditPage() {
  const id = Number(useParams().patientId);
  const navigate = useNavigate();
  const query = usePatient(id);
  const update = useUpdatePatient(id);

  return (
    <QueryBoundary query={query}>
      {(patient) => (
        <Box sx={{ maxWidth: 860 }}>
          <PageHeader title={`Edit ${patient.firstName} ${patient.lastName}`} subtitle={`Patient #${patient.id}`} />
          <Formik<PatientFormValues>
            initialValues={fromPatient(patient)}
            enableReinitialize
            validate={zodToFormikValidate(patientFormSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
              setStatus(undefined);
              try {
                await update.mutateAsync(values);
                toast.success('Patient updated');
                navigate(`/patients/${id}`);
              } catch (e) {
                if (isApiError(e)) setErrors(e.fieldErrors as FormikErrors<PatientFormValues>);
                setStatus(errorMessage(e));
              }
            }}
          >
            {({ values, errors, touched, handleChange, handleBlur, setFieldValue, setFieldTouched, isSubmitting, dirty, status, resetForm, isValid }) => {
              const f = (name: keyof PatientFormValues, label: string, extra: object = {}) => (
                <TextField fullWidth name={name} label={label} value={values[name]} onChange={handleChange} onBlur={handleBlur} error={!!(touched[name] && errors[name])} helperText={touched[name] && errors[name] ? String(errors[name]) : undefined} {...extra} />
              );
              return (
                <Form noValidate aria-label="Edit patient">
                  <Card variant="outlined">
                    <CardContent sx={{ p: 3 }}>
                      {status && <Alert severity="error" sx={{ mb: 2 }}>{status}</Alert>}
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Personal details</Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>{f('firstName', 'First name', { required: true })}</Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>{f('lastName', 'Last name', { required: true })}</Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <DatePicker label="Date of birth" disableFuture value={values.dateOfBirth ? dayjs(values.dateOfBirth) : null}
                            onChange={(d) => void setFieldValue('dateOfBirth', d && d.isValid() ? d.format('YYYY-MM-DD') : '')}
                            slotProps={{ textField: { fullWidth: true, required: true, onBlur: () => void setFieldTouched('dateOfBirth'), error: !!(touched.dateOfBirth && errors.dateOfBirth), helperText: touched.dateOfBirth ? errors.dateOfBirth : undefined } }} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>{f('gender', 'Gender', { select: true, children: ['FEMALE', 'MALE', 'OTHER'].map((g) => <MenuItem key={g} value={g}>{humanize(g)}</MenuItem>) })}</Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>{f('bloodGroup', 'Blood group', { select: true, children: [<MenuItem key="" value="">Unknown</MenuItem>, ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)] })}</Grid>
                        <Grid size={12}>{f('identityNumber', 'Identity number')}</Grid>
                      </Grid>
                      <Divider sx={{ my: 3 }} />
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Contact & medical</Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>{f('email', 'E-mail', { type: 'email', required: true })}</Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>{f('phone', 'Phone', { required: true })}</Grid>
                        <Grid size={12}>{f('address', 'Address', { multiline: true, minRows: 2 })}</Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>{f('emergencyContactName', 'Emergency contact name')}</Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>{f('emergencyContactPhone', 'Emergency contact phone')}</Grid>
                        <Grid size={12}>{f('knownAllergies', 'Known allergies', { multiline: true, minRows: 2 })}</Grid>
                      </Grid>
                      <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button onClick={() => navigate(-1)}>Cancel</Button>
                        <Button onClick={() => resetForm()} disabled={!dirty || isSubmitting}>Reset</Button>
                        <Button type="submit" variant="contained" disabled={!dirty || isSubmitting || (!isValid && Object.keys(touched).length > 0)} startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}>Save changes</Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Form>
              );
            }}
          </Formik>
        </Box>
      )}
    </QueryBoundary>
  );
}
