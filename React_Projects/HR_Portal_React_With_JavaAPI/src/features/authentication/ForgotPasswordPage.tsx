import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/api/services/authApi';

export default function ForgotPasswordPage() {
  const { t } = useTranslation(); const nav = useNavigate();
  const [busy, setBusy] = useState(false); const [devToken, setDevToken] = useState<string | null>(null); const [sent, setSent] = useState(false);
  const schema = z.object({ email: z.string().min(1, t('common.validation.required')).email(t('common.validation.email')) });
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try { const r = await authApi.forgotPassword({ email: v.email }); setSent(true); setDevToken(r?.resetToken ?? null); toast.info(t('auth.resetSent'), { toastId: 'fp' }); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  });
  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSub')}>
      <form onSubmit={submit} noValidate className="d-grid gap-3">
        <div><label className="field-label" htmlFor="email">{t('auth.email')}</label><Input id="email" type="email" autoFocus {...register('email')} />{errors.email && <div className="field-error">{errors.email.message}</div>}</div>
        <Button type="submit" size="lg" loading={busy}>{t('auth.sendReset')}</Button>
      </form>
      {sent && <div className="mt-3 rounded-md border border-info/40 bg-info/10 p-3 text-xs">{t('auth.resetSent')}
        {devToken && <div className="mt-2"><div>{t('auth.devToken')}</div><code className="break-all">{devToken}</code><div className="mt-2"><Button size="sm" onClick={() => nav(`/reset-password?token=${encodeURIComponent(devToken)}`)}>{t('auth.resetTitle')}</Button></div></div>}</div>}
      <div className="mt-3 text-center" style={{ fontSize: 13 }}><Link to="/login">{t('auth.backToLogin')}</Link></div>
    </AuthLayout>
  );
}
