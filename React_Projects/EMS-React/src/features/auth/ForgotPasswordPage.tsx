import { Alert, Button, Link, Stack, TextField } from '@mui/material';
import { useActionState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { authApi } from '@/services/authApi';
import { forgotPasswordSchema } from '@/schemas/auth';
import { errorMessage } from '@/api/errors';

interface FormState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  email?: string;
  devToken?: string;
}

/**
 * React 19 `useActionState`: the <form action={fn}> runs an async action, `pending` is tracked for us and the returned object becomes
 * the next state — no manual isSubmitting/useState wiring. (Larger forms in this app use React Hook Form; this one shows the native approach.)
 */
async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get('email') ?? '') });
  if (!parsed.success)
    return {
      status: 'error',
      message: parsed.error.issues[0].message,
      email: String(formData.get('email') ?? ''),
    };
  try {
    const res = await authApi.forgotPassword(parsed.data.email);
    return { status: 'sent', message: res.message, email: parsed.data.email, devToken: res.data?.resetToken };
  } catch (e) {
    return { status: 'error', message: errorMessage(e), email: parsed.data.email };
  }
}

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestReset, { status: 'idle' } as FormState);
  return (
    <AuthShell title="Forgot password" subtitle="We'll issue reset instructions if the account exists.">
      <form action={action} noValidate>
        <Stack spacing={2}>
          {state.status === 'error' && (
            <Alert severity="error" role="alert">
              {state.message}
            </Alert>
          )}
          {state.status === 'sent' && <Alert severity="success">{state.message}</Alert>}
          {state.devToken && (
            <Alert severity="info">
              Development mode: the backend returned the token directly.{' '}
              <Link component={RouterLink} to={`/reset-password?token=${encodeURIComponent(state.devToken)}`}>
                Open the reset page
              </Link>
            </Alert>
          )}
          <TextField
            name="email"
            label="Email"
            type="email"
            defaultValue={state.email ?? ''}
            key={state.email}
          />
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset instructions'}
          </Button>
          <Link component={RouterLink} to="/login" variant="body2" textAlign="center">
            Back to sign in
          </Link>
        </Stack>
      </form>
    </AuthShell>
  );
}
