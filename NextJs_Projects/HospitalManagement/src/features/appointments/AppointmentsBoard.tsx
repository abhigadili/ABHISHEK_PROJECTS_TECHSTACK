'use client';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { CalendarDays, List, RefreshCw, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/redux/hooks';
import { selectDate, setAppointmentSearch, setMonth, setStatusFilter, setView } from '@/store/slices/appointmentsSlice';
import { useCancelAppointment, useDoctorAppointments, usePatientAppointments } from './hooks';
import { MonthCalendar } from './MonthCalendar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatCurrency, formatDate, formatTime } from '@/lib/utilities/format';
import type { Appointment, AppointmentStatus } from '@/types';

/**
 * Appointment management (Tailwind). Server state = TanStack Query (parallel useQueries / dependent query), UI state = Redux
 * (view, filters, month, selected date), optimistic cancel = useMutation. Rows link to /appointments/[id] which an intercepting
 * route renders as a MODAL on top of this list.
 */
export function AppointmentsBoard({ scope, patientId, doctorIds, initialView }: { scope: 'patient' | 'staff'; patientId: number | null; doctorIds: number[]; initialView?: 'list' | 'calendar' }) {
  const dispatch = useAppDispatch();
  const ui = useAppSelector((s) => s.appointmentsUi);
  const { can } = useAuth();
  const view = ui.view;
  useEffect(() => { if (initialView) dispatch(setView(initialView)); }, [initialView, dispatch]);
  const patientQ = usePatientAppointments(scope === 'patient' ? patientId : null);
  const doctorQ = useDoctorAppointments(scope === 'staff' ? doctorIds : []);
  const cancel = useCancelAppointment();
  const patientData = patientQ.data; const doctorData = doctorQ.data;
  const data: Appointment[] = useMemo(() => (scope === 'patient' ? (patientData ?? []) : doctorData), [scope, patientData, doctorData]);
  const loading = scope === 'patient' ? patientQ.isPending : doctorQ.isPending;
  const failed = scope === 'patient' ? patientQ.isError : doctorQ.isError;
  const refetch = () => (scope === 'patient' ? void patientQ.refetch() : doctorQ.refetch());

  const rows = useMemo(() => {
    const t = ui.search.trim().toLowerCase();
    return data.filter((a) => (ui.status === 'ALL' || a.status === ui.status) && (!ui.selectedDate || a.date === ui.selectedDate) && (!t || `${a.patientName} ${a.doctorName} ${a.reason ?? ''}`.toLowerCase().includes(t))).sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  }, [data, ui.search, ui.status, ui.selectedDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search patient, doctor or reason" aria-label="Search appointments" className="w-72" value={ui.search} onChange={(e) => dispatch(setAppointmentSearch(e.target.value))} />
        <Select aria-label="Status" className="w-44" value={ui.status} onChange={(e) => dispatch(setStatusFilter(e.target.value as AppointmentStatus | 'ALL'))}><option value="ALL">All statuses</option>{['BOOKED', 'COMPLETED', 'CANCELLED', 'MISSED', 'RESCHEDULED'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</Select>
        <div className="ml-auto flex gap-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => dispatch(setView('list'))}><List className="size-4" />List</Button>
          <Button variant={view === 'calendar' ? 'default' : 'outline'} size="sm" onClick={() => dispatch(setView('calendar'))}><CalendarDays className="size-4" />Calendar</Button>
          <Button variant="outline" size="sm" onClick={refetch} aria-label="Refresh"><RefreshCw className="size-4" /></Button>
        </div>
      </div>
      {scope === 'staff' && doctorIds.length === 0 ? <EmptyState title="No doctor profile linked" description="Appointments are listed per doctor. Your login is not linked to a doctor profile." /> : loading ? <TableSkeleton /> : failed ? <ErrorState message="Appointments could not be loaded." action={<Button onClick={refetch}>Retry</Button>} /> : (
        <div className={view === 'calendar' ? 'grid gap-4 lg:grid-cols-[360px_1fr]' : ''}>
          {view === 'calendar' && <MonthCalendar month={ui.month} appointments={data} selected={ui.selectedDate} onMonth={(m) => dispatch(setMonth(m))} onSelect={(d) => dispatch(selectDate(d))} />}
          <div className="min-w-0">
            {ui.selectedDate && <p className="mb-2 flex items-center gap-2 text-sm">Showing {formatDate(ui.selectedDate)}<button className="text-primary" onClick={() => dispatch(selectDate(null))}><X className="inline size-4" />clear</button></p>}
            {rows.length === 0 ? <EmptyState title="No appointments match" description="Change the filters or book a new appointment." action={can('appointments:book') ? <Button asChild><Link href="/appointments/book">Book appointment</Link></Button> : undefined} /> : (
              <Table><THead><TR><TH>When</TH><TH>Patient</TH><TH>Doctor</TH><TH>Fee</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></TR></THead><TBody>{rows.slice(0, 200).map((a) => (
                <TR key={a.id}><TD><Link href={`/appointments/${a.id}`} className="font-medium text-primary hover:underline">{formatDate(a.date)} · {formatTime(a.startTime)}</Link></TD><TD>{a.patientName}</TD><TD>{a.doctorName}</TD><TD className="num">{formatCurrency(a.fee)}</TD><TD><StatusBadge status={a.status} /></TD>
                  <TD>{a.status === 'BOOKED' && can('appointments:manage') && <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables?.id === a.id} onClick={() => { if (confirm('Cancel this appointment?')) cancel.mutate({ id: a.id }); }}>Cancel</Button>}</TD></TR>))}</TBody></Table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
