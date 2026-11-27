'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ActionForm, Field, Option, SubmitButton } from '@/components/forms/ActionForm';
import { FileUpload, type FileUploadHandle } from '@/components/forms/FileUpload';
import { Button } from '@/components/common/ui';
import { Alert } from '@/components/common/ui';
import { useFormState } from '@/components/forms/ActionForm';
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from '@/actions/auth';
import { getJson } from '@/lib/client/fetcher';
import { USERNAME_RE } from '@/schemas/forms';

export function LoginForm({ next, identifier }: { next?: string; identifier?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4" aria-label="Sign in form">
      <input type="hidden" name="next" value={next ?? ''} />
      <Field name="identifier" label="Username or email" required autoComplete="username" defaultValue={identifier} />
      <Field name="password" label="Password" type="password" required autoComplete="current-password" />
      <SubmitButton pendingLabel="Signing in…" className="w-full">Sign in</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
        <Link href="/register" className="text-primary hover:underline">Create an account</Link>
      </div>
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotPasswordAction} className="space-y-4" toastOnSuccess={false}>
      <Field name="email" label="Email" type="email" required autoComplete="email" />
      <SubmitButton pendingLabel="Sending…" className="w-full">Send reset instructions</SubmitButton>
      <ResetTokenHint />
      <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </ActionForm>
  );
}
/** Development convenience: the backend only returns the token when it runs with EXPOSE_RESET_TOKEN=true. */
function ResetTokenHint() {
  const s = useFormState();
  const t = s.data?.resetToken;
  if (!s.ok || !t) return null;
  return <Alert kind="info">Development mode: <Link className="font-semibold underline" href={`/reset-password?token=${encodeURIComponent(String(t))}`}>open the reset page</Link></Alert>;
}

export function ResetForm({ token }: { token?: string }) {
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      <Field name="token" label="Reset token" required defaultValue={token} />
      <Field name="newPassword" label="New password" type="password" required autoComplete="new-password" hint="10+ characters with upper, lower, digit and symbol" />
      <Field name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
      <SubmitButton className="w-full">Reset password</SubmitButton>
    </ActionForm>
  );
}

export function RegisterForm({ departments, designations }: { departments: { id: number; name: string }[]; designations: { id: number; name: string }[] }) {
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const picker = useRef<FileUploadHandle>(null);
  // the blob URL is created in the event handler (not an effect) and revoked when replaced / on unmount
  const pick = (f: File | null) => { setPicture(f); setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : null; }); };
  return (
    <ActionForm action={registerAction} className="space-y-4" aria-label="Registration form" encType="multipart/form-data">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="First name" required autoComplete="given-name" />
        <Field name="lastName" label="Last name" required autoComplete="family-name" />
        <UsernameField />
        <Field name="email" label="Email address" type="email" required autoComplete="email" />
        <Field name="mobile" label="Mobile number" required placeholder="+1 555 0100" autoComplete="tel" />
        <Field name="dateOfBirth" label="Date of birth" type="date" required autoComplete="bday" />
        <Field name="gender" label="Gender" as="select" required>
          <Option value="">Select…</Option><Option value="MALE">Male</Option><Option value="FEMALE">Female</Option><Option value="OTHER">Other</Option><Option value="PREFER_NOT_TO_SAY">Prefer not to say</Option>
        </Field>
        <span className="hidden sm:block" />
        <Field name="password" label="Password" type="password" required autoComplete="new-password" hint="10+ characters with upper, lower, digit and symbol" />
        <Field name="confirmPassword" label="Confirm password" type="password" required autoComplete="new-password" />
      </div>
      <Field name="address" label="Address" as="textarea" rows={2} maxLength={255} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="departmentId" label="Department (optional)" as="select"><Option value="">Not sure yet</Option>{departments.map((d) => <Option key={d.id} value={String(d.id)}>{d.name}</Option>)}</Field>
        <Field name="designationId" label="Designation (optional)" as="select"><Option value="">Not sure yet</Option>{designations.map((d) => <Option key={d.id} value={String(d.id)}>{d.name}</Option>)}</Field>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Profile picture (optional)</p>
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: preview of a file chosen in the browser can't go through the image optimizer */}
          {preview && <img src={preview} alt="Selected profile picture preview" width={56} height={56} className="size-14 rounded-full object-cover" />}
          <FileUpload ref={picker} accept="image/jpeg,image/png,image/webp" label={picture ? 'Change picture' : 'Choose picture'} onPick={pick} />
          {picture && <Button type="button" variant="ghost" onClick={() => picker.current?.clear()}>Remove</Button>}
        </div>
        <p className="mt-1 text-xs text-muted">JPEG, PNG or WebP, up to 2 MB.</p>
      </div>
      <SubmitButton pendingLabel="Creating account…" className="w-full">Create account</SubmitButton>
      <p className="text-center text-sm"><Link href="/login" className="text-primary hover:underline">Already registered? Sign in</Link></p>
    </ActionForm>
  );
}

/** Live availability check against the public BFF endpoint: debounced on blur, cancellable, never blocks submit (the backend re-checks). */
function UsernameField() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const check = async (raw: string) => {
    ctrl.current?.abort();
    const u = raw.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) { setMsg(null); return; }
    ctrl.current = new AbortController();
    try { const r = await getJson<{ available: boolean }>(`/api/auth/username-available?username=${encodeURIComponent(u)}`, ctrl.current.signal); setMsg(r.available ? { ok: true, text: 'Username is available' } : { ok: false, text: 'This username is already taken' }); }
    catch (e) { if ((e as { name?: string }).name !== 'AbortError') setMsg(null); }
  };
  const state = useFormState();
  return (
    <div onBlur={(e) => { const t = e.target as HTMLInputElement; if (t.name === 'username') void check(t.value); }}>
      <Field name="username" label="Username" required autoComplete="username" hint="3–30 characters; checked for availability" />
      {msg && !state.fieldErrors?.username && <p role="status" className={`mt-1 text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}
