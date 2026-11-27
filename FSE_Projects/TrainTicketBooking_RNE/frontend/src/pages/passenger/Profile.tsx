import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Formik } from 'formik';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { changePasswordSchema, profileSchema } from '@shared/validations/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Feedback';
import { useAuth, useDocumentTitle, useToast } from '@/hooks';
import { post, put } from '@/services/api';
import { useAppDispatch } from '@/store';
import { userUpdated } from '@/store/authSlice';
import { applyServerErrors, zodValidate } from '@/utils/forms';
import type { User } from '@/types';

type PV = z.input<typeof profileSchema>;
export default function Profile() {
  useDocumentTitle('Profile'); const { user } = useAuth(); const dispatch = useAppDispatch(); const toast = useToast(); const [err, setErr] = useState<string>(); const [pwErr, setPwErr] = useState<string>();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting, isDirty } } = useForm<PV>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? '', mobile: user?.mobile ?? '' } });
  return (
    <div className="max-w-2xl space-y-6"><PageHeader title="Profile & security" />
      <Card><CardHeader><CardTitle>Personal details</CardTitle></CardHeader><CardBody>
        <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => { try { const u = await put<User>(`/users/${user!.id}`, v); dispatch(userUpdated({ ...user!, ...u })); toast('success', 'Profile updated'); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
          <FormError>{err}</FormError>
          <Field label="Full name" error={errors.name?.message}><Input {...register('name')} /></Field><Field label="Mobile" error={errors.mobile?.message}><Input maxLength={10} {...register('mobile')} /></Field>
          <Field label="E-mail" hint="E-mail cannot be changed"><Input value={user?.email} disabled readOnly /></Field>
          <div className="flex items-end"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button></div>
        </form></CardBody></Card>
      <Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardBody>
        <Formik initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }} validate={zodValidate(changePasswordSchema)}
          onSubmit={async (v, { resetForm, setSubmitting }) => { setPwErr(undefined); try { await post('/auth/change-password', v); toast('success', 'Password changed', 'Other devices have been signed out.'); resetForm(); } catch (e) { setPwErr((e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ?? 'Could not change password'); } setSubmitting(false); }}>
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form noValidate className="grid gap-4"><FormError>{pwErr}</FormError>
              {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((k) => <Field key={k} label={{ currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' }[k]} error={touched[k] ? errors[k] : undefined}><Input name={k} type="password" autoComplete={k === 'currentPassword' ? 'current-password' : 'new-password'} value={values[k]} onChange={handleChange} onBlur={handleBlur} /></Field>)}
              <div><Button type="submit" loading={isSubmitting}>Update password</Button></div></Form>)}
        </Formik></CardBody></Card>
    </div>
  );
}
