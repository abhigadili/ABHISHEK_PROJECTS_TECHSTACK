import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, Grid2 as Grid, Paper, Stack, Typography } from '@mui/material';
import EventNote from '@mui/icons-material/EventNote';
import Medication from '@mui/icons-material/Medication';
import Science from '@mui/icons-material/Science';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import type { PatientOutletContext } from './PatientDetailsPage';
import { PatientDetailGrid } from '../components/PatientDetailGrid';
import { MuiSimpleTable } from '../components/MuiSimpleTable';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { prescriptionApi } from '@/services/endpoints/prescriptionApi';
import { laboratoryApi } from '@/services/endpoints/laboratoryApi';
import { billingApi } from '@/services/endpoints/billingApi';
import { recordsApi } from '@/services/endpoints/recordsApi';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/constants/permissions';
import { AppointmentStatusBadge, BillStatusBadge, LabStatusBadge, PrescriptionStatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, humanize } from '@/utils/format';

const usePatientCtx = () => useOutletContext<PatientOutletContext>().patient;

/* ----------------------------- Overview (parallel queries) ----------------------------- */
/**
 * Parallel queries with useQueries: the four requests start together, each can fail independently, and they share cache
 * keys with the detail tabs - opening a tab afterwards is instant.
 */
export function PatientOverviewTab() {
  const p = usePatientCtx();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [appts, rx, labs, bills] = useQueries({
    queries: [
      { queryKey: queryKeys.appointments.forPatient(p.id), queryFn: ({ signal }: { signal: AbortSignal }) => appointmentApi.forPatient(p.id, signal), enabled: can(role, 'appointments:manage'), meta: { silent: true } },
      { queryKey: queryKeys.prescriptions.forPatient(p.id), queryFn: ({ signal }: { signal: AbortSignal }) => prescriptionApi.forPatient(p.id, signal), enabled: can(role, 'prescriptions:read'), meta: { silent: true } },
      { queryKey: queryKeys.laboratory.forPatient(p.id), queryFn: ({ signal }: { signal: AbortSignal }) => laboratoryApi.requestsForPatient(p.id, signal), enabled: can(role, 'lab:read'), meta: { silent: true } },
      { queryKey: queryKeys.billing.forPatient(p.id), queryFn: ({ signal }: { signal: AbortSignal }) => billingApi.forPatient(p.id, signal), enabled: can(role, 'billing:read'), meta: { silent: true } },
    ],
  });
  const tile = (icon: React.ReactNode, label: string, q: { data?: unknown[]; isPending: boolean; isError: boolean; fetchStatus: string }, to: string, extra?: string) => (
    <Grid size={{ xs: 6, md: 3 }} key={label}>
      <Paper variant="outlined" sx={{ p: 2, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => navigate(to)}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon}
          <Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="h6" fontWeight={700}>{q.fetchStatus === 'idle' && q.isPending ? 'n/a' : q.isPending ? '…' : q.isError ? '!' : q.data?.length}</Typography>
            {extra && <Typography variant="caption" color="text.secondary">{extra}</Typography>}
          </Box>
        </Stack>
      </Paper>
    </Grid>
  );
  const outstanding = bills.data?.filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE').reduce((s, b) => s + (b.totalAmount - b.paidAmount), 0);
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {tile(<EventNote color="primary" />, 'Appointments', appts, `/patients/${p.id}/appointments`)}
        {tile(<Medication color="primary" />, 'Prescriptions', rx, `/patients/${p.id}/prescriptions`)}
        {tile(<Science color="primary" />, 'Lab requests', labs, `/patients/${p.id}/lab-reports`)}
        {tile(<ReceiptLong color="primary" />, 'Invoices', bills, `/patients/${p.id}/billing`, outstanding ? `${formatCurrency(outstanding)} outstanding` : undefined)}
      </Grid>
      <Card variant="outlined"><CardContent><PatientDetailGrid patient={p} /></CardContent></Card>
    </Stack>
  );
}

/* ----------------------------- Medical history (Fetch API) ----------------------------- */
export function PatientHistoryTab() {
  const p = usePatientCtx();
  const q = useQuery({ queryKey: queryKeys.records.summary(p.id), queryFn: ({ signal }) => recordsApi.summary(p.id, signal) });
  const navigate = useNavigate();
  return (
    <QueryBoundary query={q} isEmpty={() => false}>
      {(s) => (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(s.entryCounts).map(([k, v]) => <Chip key={k} label={`${humanize(k)}: ${v}`} variant={v ? 'filled' : 'outlined'} color={v ? 'primary' : 'default'} size="small" />)}
          </Stack>
          <Alert severity={s.chronicConditions ? 'info' : 'success'} icon={false}><b>Chronic conditions:</b> {s.chronicConditions ?? 'none recorded'}</Alert>
          {s.latestEntries.length === 0 ? <Typography color="text.secondary">No clinical entries yet.</Typography> : (
            <MuiSimpleTable label="Latest clinical entries" rows={s.latestEntries} rowKey={(e) => e.id} onRowClick={(e) => navigate(`/records/entries/${e.id}`)}
              columns={[
                { key: 'when', header: 'Recorded', cell: (e) => formatDateTime(e.recordedAt) },
                { key: 'type', header: 'Type', cell: (e) => <Chip size="small" label={humanize(e.entryType)} /> },
                { key: 'title', header: 'Title', cell: (e) => e.title },
                { key: 'src', header: 'Source', cell: (e) => humanize(e.source) },
              ]} />
          )}
          <Box><Button onClick={() => navigate(`/records/patients/${p.id}`)}>Open full medical record</Button></Box>
        </Stack>
      )}
    </QueryBoundary>
  );
}

/* ----------------------------- Appointments ----------------------------- */
export function PatientAppointmentsTab() {
  const p = usePatientCtx();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: queryKeys.appointments.forPatient(p.id), queryFn: ({ signal }) => appointmentApi.forPatient(p.id, signal) });
  return (
    <QueryBoundary query={q} emptyTitle="No appointments yet" emptyDescription="Appointments booked for this patient will appear here.">
      {(rows) => (
        <MuiSimpleTable label="Appointment history" rows={[...rows].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))} rowKey={(a) => a.id} onRowClick={(a) => navigate(`/appointments/${a.id}`)}
          columns={[
            { key: 'date', header: 'Date', cell: (a) => formatDate(a.date) },
            { key: 'time', header: 'Time', cell: (a) => formatTimeRange(a.startTime, a.endTime) },
            { key: 'doc', header: 'Doctor', cell: (a) => a.doctorName },
            { key: 'reason', header: 'Reason', cell: (a) => a.reason ?? '—' },
            { key: 'status', header: 'Status', cell: (a) => <AppointmentStatusBadge status={a.status} /> },
            { key: 'fee', header: 'Fee', align: 'right', cell: (a) => formatCurrency(a.fee) },
          ]} />
      )}
    </QueryBoundary>
  );
}

/* ----------------------------- Prescriptions ----------------------------- */
export function PatientPrescriptionsTab() {
  const p = usePatientCtx();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: queryKeys.prescriptions.forPatient(p.id), queryFn: ({ signal }) => prescriptionApi.forPatient(p.id, signal) });
  return (
    <QueryBoundary query={q} emptyTitle="No prescriptions" emptyDescription="Prescriptions issued by doctors will appear here.">
      {(rows) => (
        <MuiSimpleTable label="Prescriptions" rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/prescriptions/${r.id}`)}
          columns={[
            { key: 'id', header: '#', cell: (r) => r.id },
            { key: 'issued', header: 'Issued', cell: (r) => formatDate(r.issuedAt) },
            { key: 'dx', header: 'Diagnosis', cell: (r) => r.diagnosis ?? '—' },
            { key: 'meds', header: 'Medicines', cell: (r) => r.items.map((i) => i.medicineName).join(', ') },
            { key: 'doc', header: 'Doctor', cell: (r) => r.doctorName },
            { key: 'status', header: 'Status', cell: (r) => <PrescriptionStatusBadge status={r.status} /> },
          ]} />
      )}
    </QueryBoundary>
  );
}

/* ----------------------------- Lab reports ----------------------------- */
export function PatientLabTab() {
  const p = usePatientCtx();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: queryKeys.laboratory.forPatient(p.id), queryFn: ({ signal }) => laboratoryApi.requestsForPatient(p.id, signal) });
  return (
    <QueryBoundary query={q} emptyTitle="No lab tests requested">
      {(rows) => (
        <MuiSimpleTable label="Lab requests" rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/lab/requests/${r.id}`)}
          columns={[
            { key: 'acc', header: 'Accession', cell: (r) => r.accessionNumber ?? 'pending' },
            { key: 'test', header: 'Test', cell: (r) => r.testName },
            { key: 'when', header: 'Requested', cell: (r) => formatDateTime(r.requestedAt) },
            { key: 'status', header: 'Status', cell: (r) => <LabStatusBadge status={r.status} /> },
          ]} />
      )}
    </QueryBoundary>
  );
}

/* ----------------------------- Billing ----------------------------- */
export function PatientBillingTab() {
  const p = usePatientCtx();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: queryKeys.billing.forPatient(p.id), queryFn: ({ signal }) => billingApi.forPatient(p.id, signal) });
  return (
    <QueryBoundary query={q} emptyTitle="No invoices">
      {(rows) => (
        <MuiSimpleTable label="Invoices" rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/billing/invoices/${r.id}`)}
          columns={[
            { key: 'no', header: 'Invoice', cell: (r) => r.billNumber },
            { key: 'type', header: 'Type', cell: (r) => humanize(r.billType) },
            { key: 'due', header: 'Due', cell: (r) => formatDate(r.dueDate) },
            { key: 'total', header: 'Total', align: 'right', cell: (r) => formatCurrency(r.totalAmount, r.currency) },
            { key: 'paid', header: 'Paid', align: 'right', cell: (r) => formatCurrency(r.paidAmount, r.currency) },
            { key: 'status', header: 'Status', cell: (r) => <BillStatusBadge status={r.status} /> },
          ]} />
      )}
    </QueryBoundary>
  );
}
