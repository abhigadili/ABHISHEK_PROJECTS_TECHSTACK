import Link from 'next/link';
import { CalendarPlus, FlaskConical, Pill, UserPlus } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/constants/permissions';
import { Button } from '@/components/ui/button';

/** SSR (dynamic rendering): the page reads the request's cookies, so it is rendered per request with the signed-in user's role. */
export default async function DashboardPage() {
  const s = await requireSession('/dashboard');
  const actions = [
    can(s.role, 'appointments:book') && { href: '/appointments/book', label: 'Book appointment', icon: CalendarPlus },
    can(s.role, 'patients:create') && { href: '/patients/register', label: 'Register patient', icon: UserPlus },
    can(s.role, 'lab:request') && { href: '/laboratory/request', label: 'Request lab test', icon: FlaskConical },
    can(s.role, 'prescriptions:create') && { href: '/prescriptions/generate', label: 'New prescription', icon: Pill },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Pill }[];
  if (!actions.length) return null;
  return <div className="mb-6 flex flex-wrap gap-2">{actions.map((a) => <Button key={a.href} asChild variant="outline" size="sm"><Link href={a.href}><a.icon className="size-4" />{a.label}</Link></Button>)}</div>;
}
