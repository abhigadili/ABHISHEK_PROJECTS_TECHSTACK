import type { Metadata } from 'next';
import Image from 'next/image';
import { ChangePasswordForm } from '@/components/forms/ChangePasswordForm';
import { ProfileForm } from '@/components/forms/ProfileForm';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/Feedback';
import { requireUser } from '@/lib/server/session';
import { fmtDateTime, label } from '@/utils/format';

export const metadata: Metadata = { title: 'Profile & security', robots: { index: false } };
export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl space-y-6"><PageHeader title="Profile & security" />
      <Card><CardBody className="flex items-center gap-4">
        {/* Remote image allow-listed in next.config (images.remotePatterns); optimised + lazy by default */}
        <Image src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=4f46e5&color=fff&size=128`} alt={`${user.name} avatar`} width={64} height={64} className="rounded-full" />
        <div><p className="font-semibold">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p><div className="mt-1 flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r} tone="indigo">{label(r)}</Badge>)}</div>{user.lastLoginAt && <p className="mt-1 text-xs text-slate-400">Last sign-in {fmtDateTime(user.lastLoginAt)}</p>}</div>
      </CardBody></Card>
      <Card><CardHeader><CardTitle>Personal details</CardTitle></CardHeader><CardBody><ProfileForm user={user} /></CardBody></Card>
      <Card><CardHeader><CardTitle>Change password</CardTitle></CardHeader><CardBody><ChangePasswordForm /></CardBody></Card>
    </div>
  );
}
