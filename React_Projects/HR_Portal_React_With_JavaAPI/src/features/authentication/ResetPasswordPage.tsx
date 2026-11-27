import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { AuthLayout } from './AuthLayout';
import { strongPassword } from './passwordSchema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/api/services/authApi';

export default function ResetPasswordPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const [sp] = useSearchParams(); const [busy, setBusy] = useState(false);
  const schema = z.object({ token: z.string().min(1, t('common.validation.required')), newPassword: strongPassword(t), confirm: z.string() }).refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: t('auth.passwordMismatch') });
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { token: sp.get('token') ?? '' } });
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try { await authApi.resetPassword({ token: v.token, newPassword: v.newPassword }); toast.success(t('auth.resetDone')); nav('/login', { replace: true }); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  });
  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.passwordRules')}>
      <form onSubmit={submit} noValidate className="d-grid gap-3">
        <div><label className="field-label">{t('auth.resetToken')}</label><Input {...register('token')} />{errors.token && <div className="field-error">{errors.token.message}</div>}</div>
        <div><label className="field-label">{t('auth.newPassword')}</label><Input type="password" autoComplete="new-password" {...register('newPassword')} />{errors.newPassword && <div className="field-error">{errors.newPassword.message}</div>}</div>
        <div><label className="field-label">{t('auth.confirmPassword')}</label><Input type="password" autoComplete="new-password" {...register('confirm')} />{errors.confirm && <div className="field-error">{errors.confirm.message}</div>}</div>
        <Button type="submit" size="lg" loading={busy}>{t('common.submit')}</Button>
      </form>
      <div className="mt-3 text-center" style={{ fontSize: 13 }}><Link to="/login">{t('auth.backToLogin')}</Link></div>
    </AuthLayout>
  );
}
