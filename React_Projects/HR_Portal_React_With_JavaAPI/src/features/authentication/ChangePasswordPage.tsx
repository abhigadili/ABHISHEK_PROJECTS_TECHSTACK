import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { AuthLayout } from './AuthLayout';
import { strongPassword } from './passwordSchema';
import { endSessionLocally } from './authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/api/services/authApi';
import { useAppSelector } from '@/store/redux';
import type { ChangePasswordRequest } from '@/api/types/auth';

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation(); const [busy, setBusy] = useState(false);
  const schema = z.object({ currentPassword: z.string().min(1, t('common.validation.required')), newPassword: strongPassword(t), confirm: z.string() }).refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: t('auth.passwordMismatch') });
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try { await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword } as ChangePasswordRequest); toast.success(t('auth.changeDone')); endSessionLocally(); onDone(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  });
  return (
    <form onSubmit={submit} noValidate className="d-grid gap-3">
      <div><label className="field-label">{t('auth.currentPassword')}</label><Input type="password" autoComplete="current-password" {...register('currentPassword')} />{errors.currentPassword && <div className="field-error">{errors.currentPassword.message}</div>}</div>
      <div><label className="field-label">{t('auth.newPassword')}</label><Input type="password" autoComplete="new-password" {...register('newPassword')} />{errors.newPassword && <div className="field-error">{errors.newPassword.message}</div>}<div className="mt-1 text-[11px] text-muted">{t('auth.passwordRules')}</div></div>
      <div><label className="field-label">{t('auth.confirmPassword')}</label><Input type="password" autoComplete="new-password" {...register('confirm')} />{errors.confirm && <div className="field-error">{errors.confirm.message}</div>}</div>
      <Button type="submit" loading={busy}>{t('common.submit')}</Button>
    </form>
  );
}
/** Forced screen shown right after login when the backend says mustChangePassword. */
export default function ChangePasswordPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const must = useAppSelector((s) => s.auth.mustChangePassword);
  return (
    <AuthLayout title={t('auth.changeTitle')} subtitle={must ? t('auth.mustChange') : t('auth.passwordRules')}>
      <ChangePasswordForm onDone={() => nav('/login', { replace: true })} />
    </AuthLayout>
  );
}
