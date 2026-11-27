import { Alert, Button, Link, Stack, TextField } from '@mui/material';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthShell } from './AuthShell';
import { loginSchema, type LoginValues } from '@/schemas/auth';
import { useAuth } from '@/hooks/useAuth';

/** MUI's TextField puts `ref` on the wrapper, so RHF's registration ref must go to the real <input> through `inputRef`. */
function RegisteredField({
  label,
  type,
  autoComplete,
  error,
  registration,
}: {
  label: string;
  type: string;
  autoComplete: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const { ref, ...rest } = registration;
  return (
    <TextField
      label={label}
      type={type}
      error={!!error}
      helperText={error}
      inputRef={ref}
      slotProps={{ htmlInput: { autoComplete } }}
      {...rest}
    />
  );
}

export default function LoginPage() {
  const { login, error, status, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as { registered?: string } | null)?.registered;
  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;

  const methods = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: (location.state as { registered?: string } | null)?.registered ?? '',
      password: '',
    },
    mode: 'onTouched',
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = methods;

  useEffect(() => () => clearError(), [clearError]); // leaving the page clears a stale error message

  const onSubmit = handleSubmit(async ({ identifier, password }) => {
    const ok = await login(identifier, password);
    if (ok) navigate(from ? `${from.pathname}${from.search ?? ''}` : '/dashboard', { replace: true });
  });

  return (
    <AuthShell title="Sign in" subtitle="Use your username (or email) and password.">
      {/* Uncontrolled registration: `register` attaches a ref + name to the native input, React re-renders only for errors (see docs 11) */}
      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {registered && !error && (
            <Alert severity="success" role="status">
              Registration successful. Sign in as <strong>{registered}</strong> with the password you chose.
            </Alert>
          )}
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          <RegisteredField
            label="Username or email"
            type="text"
            autoComplete="username"
            error={errors.identifier?.message}
            registration={register('identifier')}
          />
          <RegisteredField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            registration={register('password')}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting || status === 'loading'}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link component={RouterLink} to="/forgot-password" variant="body2" textAlign="center">
            Forgot your password?
          </Link>
          <Link component={RouterLink} to="/register" variant="body2" textAlign="center">
            New here? Create an account
          </Link>
        </Stack>
      </form>
    </AuthShell>
  );
}
