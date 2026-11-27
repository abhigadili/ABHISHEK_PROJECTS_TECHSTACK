'use client';
import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { beginMfaAction, changePasswordAction, confirmMfaAction, disableMfaAction, savePreferencesAction } from './actions';
import { changePasswordSchema } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import type { z } from 'zod';
type PW = z.input<typeof changePasswordSchema>;
export function ChangePasswordForm() {
  const [p, st] = useTransition(); const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<PW>({ resolver: zodResolver(changePasswordSchema) as never });
  return <form noValidate className="max-w-md space-y-3" onSubmit={handleSubmit((v) => st(async () => { const r = await changePasswordAction(v); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) reset(); else for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof PW, { message: m }); }))}><Field label="Current password" htmlFor="cp" error={errors.currentPassword?.message}><Input id="cp" type="password" autoComplete="current-password" {...register('currentPassword')} /></Field><Field label="New password" htmlFor="np" error={errors.newPassword?.message}><Input id="np" type="password" autoComplete="new-password" {...register('newPassword')} /></Field><Field label="Confirm new password" htmlFor="cn" error={errors.confirmPassword?.message}><Input id="cn" type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field><Button type="submit" loading={p}>Change password</Button></form>;
}
/** TOTP MFA: enrol (QR + secret) → confirm with a code → one-time recovery codes → disable. */
export function MfaPanel({ enabled }: { enabled: boolean }) {
  const r = useRouter(); const [p, st] = useTransition(); const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null); const [code, setCode] = useState(''); const [codes, setCodes] = useState<string[] | null>(null); const [err, setErr] = useState('');
  if (codes) return <div className="space-y-3"><Alert tone="ok">Two-factor authentication is on. Save these recovery codes now - each works once and they are not shown again.</Alert><ul className="grid grid-cols-2 gap-2 font-mono text-sm">{codes.map((c) => <li key={c} className="rounded bg-surface2 px-2 py-1">{c}</li>)}</ul><Button onClick={() => { setCodes(null); r.refresh(); }}>I saved them</Button></div>;
  if (enabled) return <div className="space-y-3"><Alert tone="ok">Two-factor authentication is enabled for your account.</Alert><Button variant="danger" loading={p} onClick={() => { if (confirm('Disable two-factor authentication?')) st(async () => { const x = await disableMfaAction(); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); r.refresh(); }); }}>Disable</Button></div>;
  if (setup) return <div className="max-w-sm space-y-3"><p className="text-sm">Scan the QR code with an authenticator app, then enter the 6-digit code.</p><Image unoptimized src={setup.qrDataUrl} alt="TOTP QR code" width={200} height={200} className="rounded-lg border border-line bg-white p-2" /><p className="text-xs text-muted">Manual key: <span className="font-mono">{setup.secret}</span></p><Field label="Authenticator code" htmlFor="mc" error={err}><Input id="mc" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field><Button loading={p} onClick={() => st(async () => { const x = await confirmMfaAction(code); if (x.ok && x.data) setCodes((x.data as { recoveryCodes: string[] }).recoveryCodes); else setErr(x.fieldErrors?.code ?? x.message ?? 'Invalid code'); })}>Verify and enable</Button></div>;
  return <Button loading={p} onClick={() => st(async () => { const x = await beginMfaAction(); if (x.ok && x.data) setSetup(x.data as { qrDataUrl: string; secret: string }); else emitToast({ kind: 'error', text: x.message ?? '' }); })}>Set up two-factor authentication</Button>;
}
export function PreferencesForm({ initial }: { initial: { inApp: boolean; email: boolean; reminders: boolean } }) {
  const [v, setV] = useState(initial); const [p, st] = useTransition();
  return <div className="space-y-2 text-sm">{([['inApp', 'In-app notifications'], ['email', 'E-mail notifications'], ['reminders', 'Appointment reminders']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} />{l}</label>)}<Button size="sm" loading={p} onClick={() => st(async () => { const r = await savePreferencesAction(v); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}>Save preferences</Button></div>;
}
