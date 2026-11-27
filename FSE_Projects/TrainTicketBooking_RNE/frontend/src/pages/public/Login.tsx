import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { loginSchema } from '@shared/validations/auth';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { useAuth, useDocumentTitle } from '@/hooks';
import { useAppDispatch } from '@/store';
import { clearError, loginThunk } from '@/store/authSlice';

type Values = z.input<typeof loginSchema>;
export default function Login() {
  useDocumentTitle('Sign in'); const dispatch = useAppDispatch(); const { error } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  return (
    <Card className="mx-auto max-w-md"><CardBody className="space-y-4">
      <div><h1 className="text-2xl font-bold">Welcome back</h1><p className="text-sm text-slate-500">Sign in to manage your bookings.</p></div>
      <FormError>{error}</FormError>
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => { dispatch(clearError()); await dispatch(loginThunk(v)); })}>
        <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="username" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
      </form>
      <div className="flex justify-between text-sm"><Link className="text-indigo-600" to="/forgot-password">Forgot password?</Link><Link className="text-indigo-600" to="/register">Create account</Link></div>
    </CardBody></Card>
  );
}
