import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@shared/validations/auth';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { useDocumentTitle, useToast } from '@/hooks';
import { post } from '@/services/api';
import { applyServerErrors } from '@/utils/forms';

type Values = z.input<typeof registerSchema>;
export default function Register() {
  useDocumentTitle('Create account'); const nav = useNavigate(); const toast = useToast(); const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(registerSchema), mode: 'onBlur', defaultValues: { name: '', email: '', mobile: '', password: '', confirmPassword: '' } });
  const submit = handleSubmit(async (v) => {
    setFormError(undefined);
    try { await post('/auth/register', v); toast('success', 'Account created', 'Please sign in.'); nav('/login'); }
    catch (e) { setFormError(applyServerErrors(e, setError)); }
  });
  return (
    <Card className="mx-auto max-w-lg"><CardBody className="space-y-4">
      <div><h1 className="text-2xl font-bold">Create your account</h1><p className="text-sm text-slate-500">Passwords need 8+ characters with upper-case, lower-case and a digit.</p></div>
      <FormError>{formError}</FormError>
      <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field className="sm:col-span-2" label="Full name" error={errors.name?.message}><Input autoComplete="name" {...register('name')} /></Field>
        <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Mobile" error={errors.mobile?.message}><Input inputMode="numeric" maxLength={10} autoComplete="tel" {...register('mobile')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}><Input type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
        <Button type="submit" className="sm:col-span-2" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="text-center text-sm">Already registered? <Link className="text-indigo-600" to="/login">Sign in</Link></p>
    </CardBody></Card>
  );
}
