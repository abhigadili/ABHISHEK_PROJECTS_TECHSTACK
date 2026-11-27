'use client';
import { AlertTriangle, BookCopy, BookMarked, BookOpen, Coins, Redo2, Undo2, UserCheck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Stat } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, money } from '@/lib/format';

interface Dash {
  stats: Record<string, number>;
  recentlyIssued: { id: number; title: string; member: string; at: string; dueDate: string }[];
  recentlyReturned: { id: number; title: string; member: string; at: string; status: string }[];
  popularBooks: { id: number; title: string; loans: number }[];
  trends: { month: string; issued: number; returned: number; newMembers: number; totalMembers: number }[];
  categoryShare: { name: string; loans: number }[];
}
const mlabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });

export default function StaffDashboard() {
  const { user } = useAuth(); const { data: d, error, loading, reload } = useApi<Dash>('/dashboard/staff');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !d) return <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-72" /></div>;
  const s = d.stats; const trend = d.trends.map((t) => ({ ...t, label: mlabel(t.month) }));
  return (
    <>
      <PageHeader title={user?.role === 'admin' ? 'Admin dashboard' : 'Librarian dashboard'} subtitle="Live figures from the library database."
        actions={<><Link href="/staff/issue"><Button><Redo2 className="h-4 w-4" />Issue</Button></Link><Link href="/staff/return"><Button variant="secondary"><Undo2 className="h-4 w-4" />Return</Button></Link><Link href="/staff/members"><Button variant="secondary"><UserCheck className="h-4 w-4" />Members</Button></Link></>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Titles" value={s.totalBooks} icon={<BookCopy className="h-5 w-5" />} hint={`${s.totalCopies} physical copies`} />
        <Stat label="Available copies" value={s.availableCopies} tone="green" icon={<BookOpen className="h-5 w-5" />} hint={`${s.heldCopies} held for reservations`} />
        <Stat label="Borrowed copies" value={s.borrowedCopies} tone="blue" icon={<BookOpen className="h-5 w-5" />} hint={`${s.damagedOrLostCopies} damaged/lost`} />
        <Stat label="Overdue loans" value={s.overdueLoans} tone={s.overdueLoans ? 'red' : 'slate'} icon={<AlertTriangle className="h-5 w-5" />} hint={`${s.activeLoans} active loans`} />
        <Stat label="Registered members" value={s.totalMembers} icon={<Users className="h-5 w-5" />} hint={`${s.activeMembers} active${s.pendingMembers ? ` · ${s.pendingMembers} pending` : ''}`} />
        <Stat label="Pending reservations" value={s.pendingReservations} tone="purple" icon={<BookMarked className="h-5 w-5" />} />
        <Stat label="Outstanding fines" value={money(s.outstandingFines)} tone={s.outstandingFines ? 'red' : 'green'} icon={<Wallet className="h-5 w-5" />} />
        <Stat label="Payments collected" value={money(s.paymentsCollected)} tone="green" icon={<Coins className="h-5 w-5" />} hint={`${money(s.paymentsToday)} today`} />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Borrowing trends (12 months)"><div className="h-64" role="img" aria-label="Chart of books issued and returned per month"><ResponsiveContainer><BarChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={30} /><Tooltip /><Legend /><Bar dataKey="issued" name="Issued" fill="#4338ca" radius={[3, 3, 0, 0]} /><Bar dataKey="returned" name="Returned" fill="#10b981" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Membership growth"><div className="h-64" role="img" aria-label="Chart of total members per month"><ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={30} /><Tooltip /><Legend /><Line type="monotone" dataKey="totalMembers" name="Total members" stroke="#4338ca" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="newMembers" name="New members" stroke="#f59e0b" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Recently issued">{d.recentlyIssued.length ? <ul className="divide-y divide-slate-100 text-sm">{d.recentlyIssued.map((r) => <li key={r.id} className="py-2"><p className="font-medium">{r.title}</p><p className="text-xs text-slate-500">{r.member} · {fmtDateTime(r.at)}</p></li>)}</ul> : <EmptyState title="No loans yet" />}</Card>
        <Card title="Recently returned">{d.recentlyReturned.length ? <ul className="divide-y divide-slate-100 text-sm">{d.recentlyReturned.map((r) => <li key={r.id} className="py-2"><p className="font-medium">{r.title}</p><p className="text-xs text-slate-500">{r.member} · {fmtDateTime(r.at)}{r.status === 'lost' ? ' · lost' : ''}</p></li>)}</ul> : <EmptyState title="No returns yet" />}</Card>
        <Card title="Most borrowed">{d.popularBooks.length ? <ol className="space-y-2 text-sm">{d.popularBooks.map((b, i) => <li key={b.id} className="flex items-center gap-2"><span className="w-5 text-slate-400">{i + 1}.</span><Link href={`/staff/books/${b.id}`} className="flex-1 hover:text-brand-700">{b.title}</Link><span className="text-slate-500">{b.loans}</span></li>)}</ol> : <EmptyState title="No data yet" />}</Card>
      </div>
      {d.categoryShare.length > 0 && <Card title="Loans by category" className="mt-6"><div className="flex flex-wrap gap-3">{d.categoryShare.map((c) => <span key={c.name} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">{c.name} <b>{c.loans}</b></span>)}</div></Card>}
      {(s.pendingMembers > 0 || s.pendingReviews > 0) && <Card title="Needs attention" className="mt-6"><ul className="space-y-1 text-sm">{s.pendingMembers > 0 && <li><Link className="text-brand-700 hover:underline" href="/staff/members?status=pending">{s.pendingMembers} member registration(s) awaiting approval</Link></li>}{s.pendingReviews > 0 && <li><Link className="text-brand-700 hover:underline" href="/staff/reviews">{s.pendingReviews} review(s) awaiting moderation</Link></li>}</ul></Card>}
    </>
  );
}
