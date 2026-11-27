'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Checkbox, FormControlLabel, Grid, Paper } from '@mui/material';
import { RhfSelect, RhfTextField } from '@/components/forms/RhfFields';
import { saveDoctorAction } from '@/actions/doctors';
import { doctorSchema, type DoctorFormValues } from '@/schemas/doctor';
import { emitToast } from '@/components/ui/toast';
import { Controller } from 'react-hook-form';
import type { Department, Doctor, Hospital } from '@/types';

/** Doctor create/edit: React Hook Form + Zod resolver on MUI fields; dynamic department list via useWatch; conditional login fields. */
export function DoctorForm({ doctor, hospitals, departmentsByHospital }: { doctor?: Doctor; hospitals: Hospital[]; departmentsByHospital: Record<number, Department[]> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: DoctorFormValues = { firstName: doctor?.firstName ?? '', lastName: doctor?.lastName ?? '', email: doctor?.email ?? '', phone: doctor?.phone ?? '', licenseNumber: doctor?.licenseNumber ?? '', specialization: doctor?.specialization ?? '', qualification: doctor?.qualification ?? '', experienceYears: doctor?.experienceYears ?? 0, consultationFee: doctor?.consultationFee ?? 0, hospitalId: doctor?.hospitalId ?? hospitals[0]?.id ?? 0, departmentId: doctor?.departmentId ?? 0, createLogin: false, username: '', password: '' };
  const { control, handleSubmit, setError, setValue } = useForm<DoctorFormValues>({ resolver: zodResolver(doctorSchema), defaultValues: defaults, mode: 'onTouched' });
  const hospitalId = useWatch({ control, name: 'hospitalId' });
  const createLogin = useWatch({ control, name: 'createLogin' });
  const departments = departmentsByHospital[Number(hospitalId)] ?? [];

  const submit = handleSubmit((v) => { setFormError(null); start(async () => {
    const r = await saveDoctorAction(doctor?.id ?? null, v);
    if (r.ok && r.data) { emitToast({ kind: 'success', text: r.message! }); router.push(`/doctors/${r.data.id}`); router.refresh(); return; }
    setFormError(r.message ?? 'Could not save'); for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof DoctorFormValues, { message: m });
  }); });
  return (
    <Paper variant="outlined" sx={{ p: 3, maxWidth: 900 }}>
      <form onSubmit={submit} noValidate>
        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="firstName" label="First name" required /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="lastName" label="Last name" required /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="email" label="E-mail" required /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="phone" label="Phone" /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="licenseNumber" label="Licence number" required /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="specialization" label="Specialization" required /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="qualification" label="Qualification" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><RhfTextField control={control} name="experienceYears" label="Experience (yrs)" type="number" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><RhfTextField control={control} name="consultationFee" label="Fee (INR)" type="number" required /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfSelect control={control} name="hospitalId" label="Hospital" required options={hospitals.map((h) => ({ value: h.id, label: h.name }))} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><RhfSelect control={control} name="departmentId" label="Department" options={[{ value: 0, label: 'None' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} /></Grid>
          {!doctor && <Grid size={12}><Controller control={control} name="createLogin" render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => { field.onChange(e.target.checked); if (!e.target.checked) { setValue('username', ''); setValue('password', ''); } }} />} label="Also create a login account for this doctor" />} /></Grid>}
          {createLogin && <><Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="username" label="Username" required /></Grid><Grid size={{ xs: 12, sm: 6 }}><RhfTextField control={control} name="password" type="password" label="Password" required /></Grid></>}
        </Grid>
        <div className="mt-4 flex gap-2"><Button type="submit" variant="contained" disabled={pending}>{pending ? 'Saving…' : doctor ? 'Save changes' : 'Create doctor'}</Button><Button onClick={() => router.back()}>Cancel</Button></div>
      </form>
    </Paper>
  );
}
