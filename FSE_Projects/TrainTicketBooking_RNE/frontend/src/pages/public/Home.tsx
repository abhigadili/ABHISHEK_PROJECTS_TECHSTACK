import { Clock, ShieldCheck, Ticket, Wallet } from 'lucide-react';
import { SearchForm } from '@/components/SearchForm';
import { Card, CardBody } from '@/components/ui/Card';
import { useDocumentTitle } from '@/hooks';

const features = [
  { icon: Ticket, title: 'Instant PNR', text: 'Confirmed seats and a 10-digit PNR the moment payment succeeds.' },
  { icon: Clock, title: 'Segment-aware seats', text: 'A berth freed at an intermediate stop is sold again for the remaining journey.' },
  { icon: Wallet, title: 'Fair refunds', text: 'Cancellation charges follow a transparent, time-based rule table.' },
  { icon: ShieldCheck, title: 'Safe by design', text: 'No card numbers stored - only the last four digits.' },
];
export default function Home() {
  useDocumentTitle('Search trains');
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 text-white">
        <h1 className="text-3xl font-bold tracking-tight">Where to next?</h1><p className="mt-1 text-indigo-100">Search trains, pick your seats and pay in under two minutes.</p>
        <Card className="mt-6 border-0 text-slate-900"><CardBody><SearchForm /></CardBody></Card>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: I, title, text }) => <Card key={title}><CardBody><I className="text-indigo-600" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p></CardBody></Card>)}
      </section>
    </div>
  );
}
