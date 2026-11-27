import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginSchema, type LoginValues } from '@/schemas/auth';
import { useAuth, useAuthActions } from '@/contexts/AuthContext';
import { toApiError } from '@/services/axios/errors';
import { withPublicOnly } from '@/components/hoc/withAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/common/Notice';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Login: React Hook Form with UNCONTROLLED inputs (`register` = refs, no re-render per keystroke) + Zod resolver.
 * Server errors (401 invalid credentials, 429 rate limit) are shown at form level; redirects to the page the user
 * originally asked for (location.state.from).
 */
function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuthActions();
  const { logoutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } });

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (e) {
      const err = toApiError(e);
      setServerError(err.status === 401 ? 'Invalid username or password. After 8 failed attempts an account is locked for 5 minutes.' : err.status === 429 ? 'Too many sign-in attempts. Please wait a minute and try again.' : err.message);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Use your hospital account to continue.</p>
      </div>
      {logoutReason === 'expired' && <Notice tone="warning" title="Session expired">For your security you were signed out. Please sign in again.</Notice>}
      {logoutReason === 'idle' && <Notice tone="warning" title="Signed out due to inactivity">Please sign in again.</Notice>}
      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Sign in form">
        {serverError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{serverError}</div>}
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" aria-invalid={!!errors.username} {...register('username')} />
          {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" aria-invalid={!!errors.password} className="pr-10" {...register('password')} />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          <LogIn className="h-4 w-4" /> {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        New patient? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Register here</Link>
      </p>
      <p className="text-center text-xs text-muted">Forgot-password, MFA and OAuth 2.0 sign-in are not offered because the backend has no such endpoints.</p>
    </div>
  );
}

export default withPublicOnly(LoginPage);
