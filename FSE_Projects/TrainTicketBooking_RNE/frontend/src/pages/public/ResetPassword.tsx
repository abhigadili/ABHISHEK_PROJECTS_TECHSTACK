import { Form, Formik } from 'formik';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetSchema } from '@shared/validations/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { useDocumentTitle, useToast } from '@/hooks';
import { post, toApiError } from '@/services/api';
import { zodValidate } from '@/utils/forms';

export default function ResetPassword() {
  useDocumentTitle('Choose a new password'); const [params] = useSearchParams(); const nav = useNavigate(); const toast = useToast(); const [err, setErr] = useState<string>();
  const token = params.get('token') ?? '';
  if (!token) return <Card className="mx-auto max-w-md"><CardBody className="space-y-3 text-center"><p>This reset link is missing its token.</p><Link className="text-indigo-600" to="/forgot-password">Request a new link</Link></CardBody></Card>;
  return (
    <Card className="mx-auto max-w-md"><CardBody className="space-y-4">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <Formik initialValues={{ token, password: '', confirmPassword: '' }} validate={zodValidate(resetSchema)} onSubmit={async (v, { setSubmitting }) => { try { await post('/auth/reset-password', v); toast('success', 'Password updated', 'Sign in with your new password.'); nav('/login'); } catch (e) { setErr(toApiError(e).message); } setSubmitting(false); }}>
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
          <Form noValidate className="space-y-4"><FormError>{err}</FormError>
            <Field label="New password" error={touched.password ? errors.password : undefined}><Input name="password" type="password" autoComplete="new-password" value={values.password} onChange={handleChange} onBlur={handleBlur} /></Field>
            <Field label="Confirm password" error={touched.confirmPassword ? errors.confirmPassword : undefined}><Input name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={handleChange} onBlur={handleBlur} /></Field>
            <Button type="submit" className="w-full" loading={isSubmitting}>Update password</Button></Form>)}
      </Formik>
    </CardBody></Card>
  );
}
