import { Form, Formik } from 'formik';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotSchema } from '@shared/validations/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { useDocumentTitle } from '@/hooks';
import { post, toApiError } from '@/services/api';
import { zodValidate } from '@/utils/forms';

/** Formik + Zod form (the rest of the app uses React Hook Form) */
export default function ForgotPassword() {
  useDocumentTitle('Forgot password'); const [sent, setSent] = useState(false); const [err, setErr] = useState<string>();
  return (
    <Card className="mx-auto max-w-md"><CardBody className="space-y-4">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">If that e-mail is registered, a reset link is on its way. In development the link is printed in the API console.</p> : (
        <Formik initialValues={{ email: '' }} validate={zodValidate(forgotSchema)} onSubmit={async (v, { setSubmitting }) => { try { await post('/auth/forgot-password', v); setSent(true); } catch (e) { setErr(toApiError(e).message); } setSubmitting(false); }}>
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form noValidate className="space-y-4"><FormError>{err}</FormError>
              <Field label="E-mail" error={touched.email ? errors.email : undefined}><Input name="email" type="email" value={values.email} onChange={handleChange} onBlur={handleBlur} /></Field>
              <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button></Form>)}
        </Formik>)}
      <Link className="block text-center text-sm text-indigo-600" to="/login">Back to sign in</Link>
    </CardBody></Card>
  );
}
