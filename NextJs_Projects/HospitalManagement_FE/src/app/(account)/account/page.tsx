import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db';
import { notificationService } from '@/server/services/notification.service';
import { oauthGoogleEnabled } from '@/lib/configuration/env';
import { ROLE_LABEL } from '@/lib/constants/rbac';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ChangePasswordForm, PreferencesForm } from '@/features/auth/AccountPanels';
import { LazyMfaPanel } from '@/features/auth/LazyMfaPanel';
export const metadata = { title: 'Account & security', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/account'>) {
  const p = await requireUser(); const sp = await searchParams;
  const [u, prefs] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: p.userId }, include: { mfa: true, oauthAccounts: true } }), notificationService.getPreferences(p)]);
  return <><PageHeader title="Account & security" description={`${p.name} · ${ROLE_LABEL[p.role]} · ${p.email}`} />{sp.linked === 'google' && <div className="mb-4"><Alert tone="ok">Google account linked.</Alert></div>}
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardBody><ChangePasswordForm /></CardBody></Card>
      <Card><CardHeader><CardTitle>Two-factor authentication (TOTP)</CardTitle></CardHeader><CardBody><LazyMfaPanel enabled={!!u.mfa?.enabled} /></CardBody></Card>
      <Card><CardHeader><CardTitle>Linked accounts</CardTitle></CardHeader><CardBody className="space-y-3 text-sm">{u.oauthAccounts.length ? u.oauthAccounts.map((a) => <p key={a.id}>{a.provider}: {a.email}</p>) : <p className="text-muted">No linked sign-in providers.</p>}{oauthGoogleEnabled() ? !u.oauthAccounts.some((a) => a.provider === 'google') && <Button asChild variant="outline"><a href="/api/v1/auth/oauth/google?link=1">Link Google account</a></Button> : <p className="text-xs text-muted">Google OAuth is not configured on this server.</p>}</CardBody></Card>
      <Card id="preferences"><CardHeader><CardTitle>Notification preferences</CardTitle></CardHeader><CardBody><PreferencesForm initial={{ inApp: prefs.inApp, email: prefs.email, reminders: prefs.reminders }} /></CardBody></Card></div></>;
}
