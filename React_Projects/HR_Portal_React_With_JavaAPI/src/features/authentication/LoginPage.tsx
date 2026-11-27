import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { performLogin } from './authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConnectionStore } from '@/store/zustand/connectionStore';

export default function LoginPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const loc = useLocation() as any;
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const online = useConnectionStore((s) => s.online);
  const schema = z.object({ username: z.string().min(1, t('common.validation.required')).max(150), password: z.string().min(1, t('common.validation.required')).max(200) });
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (v) => {
    setBusy(true); setErr(null);
    try {
      const tr = await performLogin(v.username.trim(), v.password);
      toast.success(t('auth.welcome', { name: tr.user?.username ?? v.username }), { toastId: 'login' });
      nav(tr.mustChangePassword ? '/change-password' : loc.state?.from ?? '/', { replace: true });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  });
  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSub')}>
      {!online && <div role="alert" className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">{t('common.backendDown')} — {t('common.backendDownHint')}</div>}
      {err && <div role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{err}</div>}
      <form onSubmit={submit} noValidate className="d-grid gap-3">
        <div><label className="field-label" htmlFor="username">{t('auth.username')}</label><Input id="username" autoComplete="username" autoFocus {...register('username')} />{errors.username && <div className="field-error">{errors.username.message}</div>}</div>
        <div><label className="field-label" htmlFor="password">{t('auth.password')}</label>
          <div className="relative"><Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" {...register('password')} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent text-muted" onClick={() => setShow(!show)} aria-label="toggle password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          {errors.password && <div className="field-error">{errors.password.message}</div>}</div>
        <Button type="submit" size="lg" loading={busy}>{t('auth.signIn')}</Button>
        <div className="d-flex justify-content-between" style={{ fontSize: 13 }}><Link to="/forgot-password">{t('auth.forgot')}</Link><Link to="/register">{t('auth.register')}</Link></div>
      </form>
    </AuthLayout>
  );
}
