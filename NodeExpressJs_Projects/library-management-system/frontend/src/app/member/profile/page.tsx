'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PictureUploader } from '@/components/PictureUploader';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, ErrorState, PageHeader, Select, Skeleton, Tabs, TextInput } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { memberFields, passwordRules, phoneRule } from '@/lib/schemas';

const detailsSchema = z.object({ fullName: memberFields.fullName, phone: phoneRule, dateOfBirth: memberFields.dateOfBirth, gender: z.string().optional(), address: memberFields.address, city: memberFields.city, state: memberFields.state, postalCode: memberFields.postalCode, country: memberFields.country });
type DV = z.infer<typeof detailsSchema>;
const pwSchema = z.object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: passwordRules, confirmPassword: z.string() }).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function ProfilePage() {
  const { user, refresh } = useAuth(); const toast = useToast(); const [tab, setTab] = useState('details');
  const { data: p, error, reload } = useApi<any>('/profile');
  const form = useForm<DV>({ resolver: zodResolver(detailsSchema) });
  const { run, formError, busy } = useServerSubmit(form);
  const pw = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  const pwRun = useServerSubmit(pw);
  useEffect(() => { if (p) form.reset({ fullName: p.fullName ?? '', phone: p.phone ?? '', dateOfBirth: p.dateOfBirth ?? '', gender: p.gender ?? '', address: p.address ?? '', city: p.city ?? '', state: p.state ?? '', postalCode: p.postalCode ?? '', country: p.country ?? '' }); }, [p]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!p || !user) return <Skeleton className="h-64" />;
  const e = form.formState.errors;
  return (
    <>
      <PageHeader title="My profile" subtitle={`Member ID ${p.memberCode} · registered ${fmtDate(p.registrationDate)} · ${p.email}`} />
      <Tabs tabs={[{ key: 'details', label: 'Personal details' }, { key: 'picture', label: 'Profile picture' }, { key: 'password', label: 'Change password' }]} value={tab} onChange={setTab} />
      {tab === 'details' && (
        <Card><form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => run(async () => { await api.patch('/profile', Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : x]).filter(([k, x]) => x !== null || !['fullName', 'phone'].includes(k as string)))); await Promise.all([refresh(), reload()]); toast.success('Profile updated'); }))}>
          {formError && <Alert>{formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Full name" required error={e.fullName?.message} {...form.register('fullName')} />
            <TextInput label="Email" value={p.email} disabled hint="Contact the library to change your email." readOnly />
            <TextInput label="Phone" type="tel" required error={e.phone?.message} {...form.register('phone')} />
            <TextInput label="Date of birth" type="date" error={e.dateOfBirth?.message} {...form.register('dateOfBirth')} />
            <Select label="Gender" {...form.register('gender')}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select>
            <div className="sm:col-span-2"><TextInput label="Street address" error={e.address?.message} {...form.register('address')} /></div>
            <TextInput label="City" error={e.city?.message} {...form.register('city')} /><TextInput label="State / region" {...form.register('state')} />
            <TextInput label="Postal code" error={e.postalCode?.message} {...form.register('postalCode')} /><TextInput label="Country" error={e.country?.message} {...form.register('country')} />
          </div>
          <Button type="submit" loading={busy}>Save changes</Button>
        </form></Card>
      )}
      {tab === 'picture' && <Card><PictureUploader userId={user.id} name={user.fullName} hasPicture={user.hasPicture} version={user.pictureUpdatedAt} onChanged={refresh} /></Card>}
      {tab === 'password' && (
        <Card><form noValidate className="max-w-md space-y-4" onSubmit={pw.handleSubmit((v) => pwRun.run(async () => { await api.post('/auth/change-password', v); pw.reset(); toast.success('Password changed. Other devices were signed out.'); }))}>
          {pwRun.formError && <Alert>{pwRun.formError}</Alert>}
          <TextInput label="Current password" type="password" autoComplete="current-password" required error={pw.formState.errors.currentPassword?.message} {...pw.register('currentPassword')} />
          <TextInput label="New password" type="password" autoComplete="new-password" required hint="8+ characters with upper-case, lower-case and a digit." error={pw.formState.errors.newPassword?.message} {...pw.register('newPassword')} />
          <TextInput label="Confirm new password" type="password" autoComplete="new-password" required error={pw.formState.errors.confirmPassword?.message} {...pw.register('confirmPassword')} />
          <Button type="submit" loading={pwRun.busy}>Change password</Button>
        </form></Card>
      )}
    </>
  );
}
