'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid } from '@mui/material';
import { MuiSelect, MuiText } from '@/components/forms/MuiFields';
import { userCreateSchema, type UserFormValues } from '@/lib/validations/admin';
import { createUserAction } from './actions';
import { emitToast } from '@/components/ui/toast';
import { ROLE_KEYS, ROLE_LABEL } from '@/lib/constants/rbac';
/** MUI Dialog + RHF + Zod: create a staff/admin account (conditional rule: hospital required for hospital staff roles). */
export function CreateUserDialog({ hospitals, allowedRoles }: { hospitals: { id: number; name: string }[]; allowedRoles: string[] }) {
  const [open, setOpen] = useState(false); const [p, st] = useTransition(); const r = useRouter(); const [err, setErr] = useState<string | null>(null);
  const { control, handleSubmit, setError, reset } = useForm<UserFormValues>({ resolver: zodResolver(userCreateSchema) as never, defaultValues: { email: '', firstName: '', lastName: '', phone: '', role: allowedRoles[0] as never, hospitalId: hospitals.length === 1 ? hospitals[0].id : 0, password: '' } });
  const submit = handleSubmit((v) => st(async () => { const x = await createUserAction(v); if (x.ok) { emitToast({ kind: 'success', text: x.message! }); setOpen(false); reset(); r.refresh(); } else { setErr(x.message ?? 'Failed'); for (const [k, m] of Object.entries(x.fieldErrors ?? {})) setError(k as keyof UserFormValues, { message: m }); } }));
  return <><Button variant="contained" onClick={() => setOpen(true)}>Add user</Button><Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Add user</DialogTitle><form onSubmit={submit} noValidate><DialogContent>{err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}<Grid container spacing={2} sx={{ mt: 0 }}><Grid size={6}><MuiText control={control} name="firstName" label="First name" required /></Grid><Grid size={6}><MuiText control={control} name="lastName" label="Last name" required /></Grid><Grid size={12}><MuiText control={control} name="email" label="E-mail" required /></Grid><Grid size={6}><MuiText control={control} name="phone" label="Phone" /></Grid><Grid size={6}><MuiSelect control={control} name="role" label="Role" required options={ROLE_KEYS.filter((k) => allowedRoles.includes(k)).map((k) => ({ value: k, label: ROLE_LABEL[k] }))} /></Grid><Grid size={12}><MuiSelect control={control} name="hospitalId" label="Hospital" options={[{ value: 0, label: 'None (global)' }, ...hospitals.map((h) => ({ value: h.id, label: h.name }))]} /></Grid><Grid size={12}><MuiText control={control} name="password" type="password" label="Initial password" required helperText="10+ characters with upper, lower case and a digit" /></Grid></Grid></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={p}>{p ? 'Creating…' : 'Create'}</Button></DialogActions></form></Dialog></>;
}
