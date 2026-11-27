'use client';
import { Form, Formik } from 'formik';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { changePasswordAction } from '@/features/auth/actions';
import { useToast } from '@/hooks';
import { zodValidate } from '@/utils/forms';
import { changePasswordSchema } from '@/validations/auth';

const labels = { currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' } as const;
/** Formik + Zod (cross-field rules: confirmation match, new != current) + Server Action; server field errors are fed back via setErrors. */
export function ChangePasswordForm() {
  const toast = useToast(); const [err, setErr] = useState<string>();
  return (
    <Formik initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }} validate={zodValidate(changePasswordSchema)}
      onSubmit={async (v, { resetForm, setSubmitting, setErrors }) => { setErr(undefined); const r = await changePasswordAction(v); if (r.ok) { toast('success', 'Password changed', r.message); resetForm(); } else { setErr(r.message); if (r.fieldErrors) setErrors(r.fieldErrors); } setSubmitting(false); }}>
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting, dirty }) => (
        <Form noValidate className="grid gap-4"><FormError>{err}</FormError>
          {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => <Field key={k} label={labels[k]} error={touched[k] ? errors[k] : undefined}><Input name={k} type="password" autoComplete={k === 'currentPassword' ? 'current-password' : 'new-password'} value={values[k]} onChange={handleChange} onBlur={handleBlur} /></Field>)}
          <div><Button type="submit" loading={isSubmitting} disabled={!dirty}>Update password</Button></div></Form>)}
    </Formik>
  );
}
