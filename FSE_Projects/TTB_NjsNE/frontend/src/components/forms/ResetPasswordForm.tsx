'use client';
import { Form, Formik } from 'formik';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { resetPasswordAction } from '@/features/auth/actions';
import { zodValidate } from '@/utils/forms';
import { resetSchema } from '@/validations/auth';

export function ResetPasswordForm({ token }: { token: string }) {
  const [err, setErr] = useState<string>();
  return (
    <Formik initialValues={{ token, password: '', confirmPassword: '' }} validate={zodValidate(resetSchema)} onSubmit={async (v, { setSubmitting }) => { const r = await resetPasswordAction(v); if (r && !r.ok) setErr(r.message); setSubmitting(false); }}>
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
        <Form noValidate className="space-y-4"><FormError>{err}</FormError>
          <Field label="New password" error={touched.password ? errors.password : undefined}><Input name="password" type="password" autoComplete="new-password" value={values.password} onChange={handleChange} onBlur={handleBlur} /></Field>
          <Field label="Confirm password" error={touched.confirmPassword ? errors.confirmPassword : undefined}><Input name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={handleChange} onBlur={handleBlur} /></Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button></Form>)}
    </Formik>
  );
}
