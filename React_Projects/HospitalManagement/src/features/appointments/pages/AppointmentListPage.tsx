import { useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarPlus, CheckCircle2, Eye, RotateCcw, XCircle } from 'lucide-react';
import { useAppointmentFeed, useCancelAppointment, useCompleteAppointment } from '../hooks/useAppointments';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { AppointmentPaymentBadge, AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice } from '@/components/common/Notice';
import { useUrlState } from '@/hooks/useUrlState';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { formatCurrency, formatDate, formatTimeRange, todayISO } from '@/utils/format';
import { APPOINTMENT_STATUSES } from '../constants';
import type { Appointment } from '@/types';

const KEYS = ['q', 'status', 'from', 'to', 'page', 'sort', 'dir'] as const;
const PAGE_SIZE = 10;

/** Appointment list (Tailwind): role-aware feed, URL-state filters, sorting, client-side paging, cancel/complete with confirmation. */
export default function AppointmentListPage() {
  const [f, setF] = useUrlState(KEYS, { sort: 'date', dir: 'desc' });
  const navigate = useNavigate();
  const { role } = useAuth();
  const canBook = useCan('appointments:book');
  const canComplete = useCan('appointments:complete');
  const me = useCurrentPatient();
  const feed = useAppointmentFeed();
  const cancel = useCancelAppointment();
  const complete = useCompleteAppointment();
  const confirm = useRef<ConfirmDialogHandle>(null);

  const rows = useMemo(() => {
    const q = f.q.toLowerCase();
    const list = feed.data.filter((a) => (!f.status || a.status === f.status) && (!f.from || a.date >= f.from) && (!f.to || a.date <= f.to) && (!q || [a.patientName, a.doctorName, a.reason ?? '', a.billNumber ?? '', String(a.id)].some((x) => x.toLowerCase().includes(q))));
    const dir = f.dir === 'asc' ? 1 : -1;
    const key = (a: Appointment) => (f.sort === 'patient' ? a.patientName : f.sort === 'doctor' ? a.doctorName : f.sort === 'status' ? a.status : f.sort === 'fee' ? String(a.fee).padStart(10, '0') : a.date + a.startTime);
    return [...list].sort((a, b) => key(a).localeCompare(key(b)) * dir);
  }, [feed.data, f.q, f.status, f.from, f.to, f.sort, f.dir]);

  const page = Math.min(Number(f.page) || 0, Math.max(Math.ceil(rows.length / PAGE_SIZE) - 1, 0));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const onSort = useCallback((k: string) => setF({ sort: k, dir: f.sort === k && f.dir === 'asc' ? 'desc' : 'asc' }, { keepPage: true }), [f.sort, f.dir, setF]);

  const askCancel = (a: Appointment) => confirm.current?.ask({ title: 'Cancel this appointment?', message: <>{formatDate(a.date)} at {a.startTime} with {a.doctorName}. The slot is released and any unpaid consultation bill is cancelled.</>, destructive: true, confirmLabel: 'Cancel appointment', askReason: true, onConfirm: (reason) => cancel.mutateAsync({ id: a.id, reason }).then(() => undefined) });
  const askComplete = (a: Appointment) => { confirm.current?.ask({ title: 'Mark as completed?', message: <>Confirm that the consultation with {a.patientName} took place. The backend only allows this once the appointment time has started.</>, confirmLabel: 'Mark completed', askReason: true, reasonLabel: 'Doctor notes (optional)', onConfirm: (notes) => complete.mutateAsync({ id: a.id, notes }).then(() => undefined) }); };

  const columns: Column<Appointment>[] = [
    { key: 'date', header: 'When', sortable: true, cell: (a) => <div><div className="font-semibold">{formatDate(a.date)}</div><div className="text-xs text-muted">{formatTimeRange(a.startTime, a.endTime)}</div></div> },
    ...(role !== 'PATIENT' ? [{ key: 'patient', header: 'Patient', sortable: true, cell: (a: Appointment) => a.patientName }] : []),
    ...(role !== 'DOCTOR' ? [{ key: 'doctor', header: 'Doctor', sortable: true, cell: (a: Appointment) => a.doctorName }] : []),
    { key: 'reason', header: 'Reason', cell: (a) => <span className="line-clamp-1 max-w-[16rem] text-muted">{a.reason ?? '—'}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (a) => <AppointmentStatusBadge status={a.status} /> },
    { key: 'fee', header: 'Fee', sortable: true, align: 'right', cell: (a) => <div className="flex flex-col items-end gap-0.5"><span>{formatCurrency(a.fee)}</span><AppointmentPaymentBadge status={a.paymentStatus} /></div> },
    {
      key: 'actions', header: '', align: 'right',
      cell: (a) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" aria-label={`View appointment ${a.id}`} onClick={() => navigate(`/appointments/${a.id}`)}><Eye className="h-4 w-4" /></Button>
          {a.status === 'BOOKED' && <Button size="icon" variant="ghost" aria-label={`Reschedule appointment ${a.id}`} onClick={() => navigate(`/appointments/${a.id}/reschedule`)}><RotateCcw className="h-4 w-4" /></Button>}
          {a.status === 'BOOKED' && canComplete && <Button size="icon" variant="ghost" aria-label={`Complete appointment ${a.id}`} onClick={() => askComplete(a)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>}
          {a.status === 'BOOKED' && <Button size="icon" variant="ghost" aria-label={`Cancel appointment ${a.id}`} onClick={() => askCancel(a)}><XCircle className="h-4 w-4 text-red-600" /></Button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Appointments" subtitle={feed.scopeLabel} icon={<CalendarDays className="h-5 w-5" />}
        actions={<>
          <Button variant="outline" asChild><Link to="/appointments/calendar">Calendar</Link></Button>
          <Button variant="outline" asChild><Link to="/appointments/availability">Availability</Link></Button>
          {canBook && <Button asChild><Link to="/appointments/book"><CalendarPlus className="h-4 w-4" /> Book appointment</Link></Button>}
        </>} />
      {role === 'PATIENT' && me.missingProfile && <div className="mb-4"><Notice tone="warning" title="Complete your patient profile first">You need a patient profile before you can book appointments. <Link className="font-semibold underline" to="/register">Create it now</Link>.</Notice></div>}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchInput value={f.q} onSearch={(q) => setF({ q })} placeholder="Search patient, doctor, reason…" />
        <label className="text-xs font-medium text-muted">Status<select value={f.status} onChange={(e) => setF({ status: e.target.value })} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg"><option value="">All</option>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select></label>
        <label className="text-xs font-medium text-muted">From<input type="date" value={f.from} onChange={(e) => setF({ from: e.target.value })} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg" /></label>
        <label className="text-xs font-medium text-muted">To<input type="date" value={f.to} onChange={(e) => setF({ to: e.target.value })} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg" /></label>
        <Button variant="ghost" size="sm" onClick={() => setF({ from: todayISO(), to: '', status: 'BOOKED' })}>Upcoming</Button>
        {(f.q || f.status || f.from || f.to) && <Button variant="ghost" size="sm" onClick={() => setF({ q: '', status: '', from: '', to: '' })}>Clear filters</Button>}
      </div>
      {feed.isPending ? <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        : feed.isError ? <ErrorState error={feed.error} onRetry={feed.refetch} />
        : rows.length === 0 ? <EmptyState title={feed.data.length ? 'No appointments match the filters' : 'No appointments yet'} description={feed.data.length ? 'Clear a filter to see more.' : canBook ? 'Book the first appointment to see it here.' : 'Appointments will appear here once booked.'} action={canBook && !feed.data.length ? <Button asChild><Link to="/appointments/book">Book appointment</Link></Button> : undefined} />
        : <>
          <DataTable caption="Appointments" columns={columns} rows={pageRows} rowKey={(a) => a.id} sortKey={f.sort} sortDir={f.dir as 'asc' | 'desc'} onSort={onSort} onRowClick={(a) => navigate(`/appointments/${a.id}`)} rowClassName={(a) => (a.status === 'CANCELLED' ? 'opacity-60' : undefined)} />
          <Pagination page={page} totalPages={Math.ceil(rows.length / PAGE_SIZE)} totalElements={rows.length} onPageChange={(p) => setF({ page: p }, { keepPage: true })} label="appointments" />
        </>}
      <ConfirmDialog ref={confirm} />
    </>
  );
}
