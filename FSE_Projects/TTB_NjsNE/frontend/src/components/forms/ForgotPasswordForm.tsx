'use client';
import { Form, Formik } from 'formik';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { forgotPasswordAction } from '@/features/auth/actions';
import { zodValidate } from '@/utils/forms';
import { forgotSchema } from '@/validations/auth';

/** Forgot password - the Formik + Zod example (the rest of the app uses React Hook Form). */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string>(); const [err, setErr] = useState<string>();
  if (sent) return <div className="space-y-3"><p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{sent} In development the link is printed in the API console.</p><Link className="text-sm text-indigo-600" href="/login">Back to sign in</Link></div>;
  return (
    <Formik initialValues={{ email: '' }} validate={zodValidate(forgotSchema)} onSubmit={async (v, { setSubmitting }) => { const r = await forgotPasswordAction(v); if (r.ok) setSent(r.message ?? 'Check your inbox.'); else setErr(r.message); setSubmitting(false); }}>
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
        <Form noValidate className="space-y-4"><FormError>{err}</FormError>
          <Field label="E-mail" error={touched.email ? errors.email : undefined}><Input name="email" type="email" value={values.email} onChange={handleChange} onBlur={handleBlur} /></Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
          <Link className="block text-center text-sm text-indigo-600" href="/login">Back to sign in</Link></Form>)}
    </Formik>
  );
}
