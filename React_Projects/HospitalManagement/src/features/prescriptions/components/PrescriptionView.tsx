import { createContext, use, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Pill, Stethoscope, UserRound } from 'lucide-react';
import type { Prescription, PrescriptionItem } from '@/types';
import { PrescriptionStatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatDateTime } from '@/utils/format';

/**
 * Compound component for a prescription: <PrescriptionView> provides the data via context;
 * .Header / .Parties / .Diagnosis / .Items (with .Item) / .Footer can be arranged freely by the caller
 * (details page, confirmation after generating, print preview) without passing the prescription down by props.
 */
const Ctx = createContext<Prescription | null>(null);
const useRx = () => {
  const v = use(Ctx);
  if (!v) throw new Error('PrescriptionView.* must be used inside <PrescriptionView>');
  return v;
};

function Root({ prescription, children, id }: { prescription: Prescription; children: ReactNode; id?: string }) {
  return (
    <Ctx value={prescription}>
      <article id={id} aria-label={`Prescription ${prescription.id}`} className="rounded-xl border border-line bg-surface p-6 shadow-sm">{children}</article>
    </Ctx>
  );
}

function Header({ children }: { children?: ReactNode }) {
  const p = useRx();
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted"><Pill className="h-4 w-4" /> Prescription</div>
        <h2 className="mt-1 text-2xl font-bold">Rx #{p.id}</h2>
        <p className="flex items-center gap-1.5 text-sm text-muted"><CalendarClock className="h-4 w-4" /> Issued {formatDateTime(p.issuedAt)} · valid until {formatDate(p.validUntil)}</p>
      </div>
      <div className="flex items-center gap-2">{children}<PrescriptionStatusBadge status={p.status} /></div>
    </header>
  );
}

function Parties() {
  const p = useRx();
  return (
    <div className="grid gap-4 py-4 sm:grid-cols-2">
      <div className="flex gap-2 text-sm"><UserRound className="mt-0.5 h-4 w-4 text-muted" /><div><div className="text-xs text-muted">Patient</div><Link to={`/patients/${p.patientId}`} className="font-semibold hover:underline">{p.patientName}</Link> <span className="text-muted">#{p.patientId}</span></div></div>
      <div className="flex gap-2 text-sm"><Stethoscope className="mt-0.5 h-4 w-4 text-muted" /><div><div className="text-xs text-muted">Prescribed by</div><Link to={`/doctors/${p.doctorId}`} className="font-semibold hover:underline">{p.doctorName}</Link>{p.appointmentId && <> · <Link to={`/appointments/${p.appointmentId}`} className="text-brand-600 hover:underline">appointment #{p.appointmentId}</Link></>}</div></div>
    </div>
  );
}

function Diagnosis() {
  const p = useRx();
  if (!p.diagnosis && !p.notes) return null;
  return <div className="mb-4 rounded-lg bg-surface-alt p-3 text-sm">{p.diagnosis && <p><b>Diagnosis:</b> {p.diagnosis}</p>}{p.notes && <p className="mt-1"><b>Notes:</b> {p.notes}</p>}</div>;
}

function Item({ item, index }: { item: PrescriptionItem; index: number }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-3 text-muted">{index + 1}</td>
      <td className="py-2 pr-3 font-semibold">{item.medicineName}{item.instructions && <div className="text-xs font-normal text-muted">{item.instructions}</div>}</td>
      <td className="py-2 pr-3">{item.dosage}</td>
      <td className="py-2 pr-3">{item.frequency}</td>
      <td className="py-2 pr-3">{item.durationDays} d</td>
      <td className="py-2 text-right">{item.quantity}</td>
    </tr>
  );
}

function Items({ children }: { children?: (item: PrescriptionItem, index: number) => ReactNode }) {
  const p = useRx();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="pb-2 pr-3">#</th><th className="pb-2 pr-3">Medicine</th><th className="pb-2 pr-3">Dosage</th><th className="pb-2 pr-3">Frequency</th><th className="pb-2 pr-3">Duration</th><th className="pb-2 text-right">Qty</th></tr></thead>
        <tbody>{p.items.map((it, i) => (children ? children(it, i) : <Item key={it.id} item={it} index={i} />))}</tbody>
      </table>
    </div>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <footer className="no-print mt-5 flex flex-wrap gap-2 border-t border-line pt-4">{children}</footer>;
}

export const PrescriptionView = Object.assign(Root, { Header, Parties, Diagnosis, Items, Item, Footer });
