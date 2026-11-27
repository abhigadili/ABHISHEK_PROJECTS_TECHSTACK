import Link from 'next/link';
import { getDashboard } from '@/lib/server/dashboard';
import { Card } from '@/components/common/ui';
import { formatDate } from '@/lib/utils/format';

function People({ title, items, empty }: { title: string; items: { employeeId: number; name: string; date: string }[]; empty: string }) {
  return (
    <Card><h2 className="mb-2 font-semibold">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="divide-y divide-border">{items.slice(0, 8).map((p) => <li key={`${p.employeeId}-${p.date}`} className="flex justify-between py-2 text-sm"><Link className="text-primary hover:underline" href={`/employees/${p.employeeId}`}>{p.name}</Link><span className="text-muted">{formatDate(p.date)}</span></li>)}</ul>}
    </Card>
  );
}
export default async function Events() {
  const d = await getDashboard();
  if (!d) return null;
  return <div className="grid gap-4 md:grid-cols-2"><People title="Upcoming birthdays" items={d.upcomingBirthdays} empty="No birthdays in the next 30 days." /><People title="Work anniversaries" items={d.upcomingAnniversaries} empty="No anniversaries in the next 30 days." /></div>;
}
