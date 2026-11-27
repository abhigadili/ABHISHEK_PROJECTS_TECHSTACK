'use client';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Grid, Paper } from '@mui/material';
import { MuiText } from '@/components/forms/MuiFields';
import { hospitalSchema, type HospitalFormValues } from '@/lib/validations/hospital';
import { saveHospitalAction } from './actions';
import { emitToast } from '@/components/ui/toast';
/** MUI + React Hook Form + Zod: hospital profile. `facilities` is edited as comma-separated text and sent as an array (data transformation). */
export function HospitalForm({ id, defaults }: { id: number | null; defaults: { name: string; code: string; description: string; address: string; city: string; phone: string; email: string; facilities: string; operatingHours: string } }) {
  const [p, st] = useTransition(); const [err, setErr] = useState<string | null>(null);
  const { control, handleSubmit, setError, reset, formState: { isDirty } } = useForm<typeof defaults>({ defaultValues: defaults });
  const submit = handleSubmit((v) => st(async () => {
    const payload: HospitalFormValues = { ...v, facilities: v.facilities.split(',').map((x) => x.trim()).filter(Boolean) };
    const parsed = hospitalSchema.safeParse(payload); if (!parsed.success) { for (const i of parsed.error.issues) setError(String(i.path[0]) as keyof typeof defaults, { message: i.message }); return; }
    const r = await saveHospitalAction(id, payload); if (r.ok) { emitToast({ kind: 'success', text: r.message! }); reset(v); setErr(null); } else { setErr(r.message ?? 'Failed'); for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof typeof defaults, { message: m }); }
  }));
  return <Paper variant="outlined" sx={{ p: 3 }}><form onSubmit={submit} noValidate>{err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}<Grid container spacing={2}><Grid size={{ xs: 12, sm: 8 }}><MuiText control={control} name="name" label="Name" required /></Grid><Grid size={{ xs: 12, sm: 4 }}><MuiText control={control} name="code" label="Code" required /></Grid><Grid size={12}><MuiText control={control} name="description" label="Description" multiline minRows={2} /></Grid><Grid size={{ xs: 12, sm: 8 }}><MuiText control={control} name="address" label="Address" /></Grid><Grid size={{ xs: 12, sm: 4 }}><MuiText control={control} name="city" label="City" /></Grid><Grid size={{ xs: 12, sm: 6 }}><MuiText control={control} name="phone" label="Phone" /></Grid><Grid size={{ xs: 12, sm: 6 }}><MuiText control={control} name="email" label="E-mail" /></Grid><Grid size={12}><MuiText control={control} name="facilities" label="Facilities (comma separated)" /></Grid><Grid size={12}><MuiText control={control} name="operatingHours" label="Operating hours" /></Grid></Grid><div className="mt-4 flex gap-2"><Button type="submit" variant="contained" disabled={p || !isDirty}>{p ? 'Saving…' : id ? 'Save changes' : 'Create hospital'}</Button><Button disabled={!isDirty} onClick={() => reset(defaults)}>Reset</Button></div></form></Paper>;
}
