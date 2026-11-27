'use client';
import { AlertTriangle, BookOpen, BookMarked, CalendarClock, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar, Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Stat, StatusBadge } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { fmtDate, money, timeAgo } from '@/lib/format';
import type { Membership } from '@/lib/types';
import { useAuth } from '@/lib/auth';

interface Dash {
  profile: { id: number; fullName: string; email: string; memberCode: string; hasPicture: boolean };
  membership: Membership | null;
  activeLoans: { id: number; bookId: number; title: string; dueDate: string; isOverdue: boolean; daysLeft: number; renewalCount: number }[];
  overdue: unknown[]; dueSoon: { id: number }[]; recentLoans: { id: number; bookId: number; title: string; returnedAt: string; status: string }[];
  reservations: { id: number; bookId: number; title: string; status: string; expiresAt: string | null }[];
  outstandingFines: number; borrowedAllTime: number;
  notifications: { id: number; title: string; message: string; link: string | null; isRead: boolean; createdAt: string }[];
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const [now] = useState(() => Date.now());
  const { data: d, error, loading, reload } = useApi<Dash>('/dashboard/member');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !d) return <div className="space-y-4"><Skeleton className="h-24" /><div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;
  const m = d.membership;
  const daysToExpiry = m ? Math.round((Date.parse(m.endDate) - now) / 86_400_000) : null;
  return (
    <>
      <PageHeader title={`Hello, ${d.profile.fullName.split(' ')[0]}`} subtitle="Here is what is happening with your account." />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar userId={d.profile.id} name={d.profile.fullName} hasPicture={d.profile.hasPicture} version={user?.pictureUpdatedAt} size={64} />
          <div className="flex-1"><p className="text-lg font-semibold">{d.profile.fullName}</p><p className="text-sm text-slate-500">Member ID <span className="font-mono">{d.profile.memberCode}</span> · {d.profile.email}</p></div>
          {m && <div className="text-right text-sm"><Badge tone={m.expired ? 'red' : 'green'}>{m.typeName} · {m.expired ? 'expired' : m.membershipStatus}</Badge><p className="mt-1 text-slate-500">{m.expired ? 'Expired' : 'Valid until'} {fmtDate(m.endDate)}{daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30 ? ` (${daysToExpiry} days)` : ''}</p></div>}
        </div>
        {m?.expired && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Your membership has expired, so you cannot borrow until it is renewed. Please visit the library.</p>}
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Books on loan" value={d.activeLoans.length} hint={m ? `limit ${m.maxLoans}` : undefined} icon={<BookOpen className="h-5 w-5" />} />
        <Stat label="Due soon" value={d.dueSoon.length} tone={d.dueSoon.length ? 'amber' : 'slate'} hint="next 3 days" icon={<CalendarClock className="h-5 w-5" />} />
        <Stat label="Overdue" value={d.overdue.length} tone={d.overdue.length ? 'red' : 'slate'} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Outstanding dues" value={money(d.outstandingFines)} tone={d.outstandingFines > 0 ? 'red' : 'green'} icon={<Wallet className="h-5 w-5" />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Current loans" className="lg:col-span-2" action={<Link href="/member/loans" className="text-xs text-brand-700 hover:underline">View all</Link>}>
          {d.activeLoans.length ? <ul className="divide-y divide-slate-100">{d.activeLoans.map((l) => <li key={l.id} className="flex items-center justify-between gap-3 py-2.5"><Link href={`/books/${l.bookId}`} className="font-medium hover:text-brand-700">{l.title}</Link><span className={`text-sm ${l.isOverdue ? 'font-semibold text-red-700' : 'text-slate-600'}`}>{l.isOverdue ? `Overdue ${-l.daysLeft}d` : `Due ${fmtDate(l.dueDate)} (${l.daysLeft}d)`}</span></li>)}</ul> : <EmptyState title="No books on loan" />}
        </Card>
        <Card title="Reservations" action={<Link href="/member/reservations" className="text-xs text-brand-700 hover:underline">Manage</Link>}>
          {d.reservations.length ? <ul className="space-y-2">{d.reservations.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 text-sm"><Link href={`/books/${r.bookId}`} className="hover:text-brand-700"><BookMarked className="mr-1 inline h-3.5 w-3.5" />{r.title}</Link><StatusBadge status={r.status} /></li>)}</ul> : <p className="text-sm text-slate-500">No active reservations.</p>}
        </Card>
        <Card title="Recently borrowed" action={<Link href="/member/history" className="text-xs text-brand-700 hover:underline">History ({d.borrowedAllTime})</Link>}>
          {d.recentLoans.length ? <ul className="space-y-2 text-sm">{d.recentLoans.map((l) => <li key={l.id} className="flex justify-between gap-2"><Link href={`/books/${l.bookId}`} className="hover:text-brand-700">{l.title}</Link><span className="text-slate-500">{fmtDate(l.returnedAt)}</span></li>)}</ul> : <p className="text-sm text-slate-500">Nothing returned yet.</p>}
        </Card>
        <Card title="Notifications" className="lg:col-span-2" action={<Link href="/member/notifications" className="text-xs text-brand-700 hover:underline">All notifications</Link>}>
          {d.notifications.length ? <ul className="divide-y divide-slate-100">{d.notifications.map((n) => <li key={n.id} className="py-2.5 text-sm"><div className="flex items-center justify-between gap-2"><span className={n.isRead ? '' : 'font-semibold'}>{n.link ? <Link href={n.link} className="hover:text-brand-700">{n.title}</Link> : n.title}</span><span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span></div><p className="text-slate-500">{n.message}</p></li>)}</ul> : <p className="text-sm text-slate-500">You are all caught up.</p>}
        </Card>
      </div>
    </>
  );
}
