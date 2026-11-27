import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FlaskConical, Plus } from 'lucide-react';
import { useLabRequestPage, usePatientLab } from '../hooks/useLab';
import { LAB_STATUSES } from '../constants';
import { LabPriorityBadge, LabStatusBadge } from '@/components/common/StatusBadge';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Pagination } from '@/components/common/Pagination';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Notice } from '@/components/common/Notice';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useUrlState } from '@/hooks/useUrlState';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { formatCurrency, formatDateTime, humanize } from '@/utils/format';
import type { LabRequest, LabStatus } from '@/types';

const columns = (showPatient: boolean): Column<LabRequest>[] => [
  { key: 'acc', header: 'Accession', cell: (r) => <span className="font-mono text-xs">{r.accessionNumber ?? 'pending…'}</span> },
  { key: 'test', header: 'Test', cell: (r) => <div><div className="font-semibold">{r.testName}</div><div className="text-xs text-muted">{r.testCode}</div></div> },
  ...(showPatient ? [{ key: 'patient', header: 'Patient', cell: (r: LabRequest) => r.patientName }] : []),
  { key: 'prio', header: 'Priority', cell: (r) => <LabPriorityBadge status={r.priority} /> },
  { key: 'status', header: 'Status', cell: (r) => <LabStatusBadge status={r.status} /> },
  { key: 'when', header: 'Requested', cell: (r) => formatDateTime(r.requestedAt) },
  { key: 'price', header: 'Price', align: 'right', cell: (r) => formatCurrency(r.price) },
];

/** Lab requests (shadcn/ui): server-side pagination with status tabs for staff; the patient's own list for patients. */
export default function LabRequestListPage() {
  const { role } = useAuth();
  const canRequest = useCan('lab:request');
  const navigate = useNavigate();
  const [f, setF] = useUrlState(['status', 'page'] as const);
  const status = (f.status || undefined) as LabStatus | undefined;
  const page = Number(f.page) || 0;
  const staff = role !== 'PATIENT';
  const paged = useLabRequestPage(staff ? status : undefined, page, 10, staff); // patients may not call the staff list endpoint
  const own = useCurrentPatient();
  const mine = usePatientLab(role === 'PATIENT' ? (own.patient?.id ?? 0) : 0);

  return (
    <>
      <PageHeader title="Lab requests" subtitle={staff ? 'All laboratory requests' : 'Your laboratory requests'} icon={<FlaskConical className="h-5 w-5" />} actions={canRequest && <Button asChild><Link to="/lab/requests/new"><Plus className="h-4 w-4" /> Request test</Link></Button>} />
      {staff ? (
        <>
          <Tabs value={f.status || 'ALL'} onValueChange={(v) => setF({ status: v === 'ALL' ? '' : v })} className="mb-4">
            <TabsList>{['ALL', ...LAB_STATUSES].map((s) => <TabsTrigger key={s} value={s}>{s === 'ALL' ? 'All' : humanize(s)}</TabsTrigger>)}</TabsList>
          </Tabs>
          <div className={paged.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <QueryBoundary query={paged} emptyTitle="No lab requests" emptyDescription={status ? `Nothing is ${humanize(status).toLowerCase()} right now.` : 'Requests made by doctors appear here.'}>
              {(p) => (<><DataTable caption="Lab requests" columns={columns(true)} rows={p.content} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/lab/requests/${r.id}`)} /><Pagination page={p.page} totalPages={p.totalPages} totalElements={p.totalElements} onPageChange={(n) => setF({ page: n }, { keepPage: true })} label="requests" disabled={paged.isFetching} /></>)}
            </QueryBoundary>
          </div>
        </>
      ) : own.missingProfile ? <Notice tone="warning">Create your patient profile to see lab requests.</Notice> : (
        <QueryBoundary query={mine} emptyTitle="No lab requests" emptyDescription="Tests requested by your doctor will appear here.">{(rows) => <DataTable caption="My lab requests" columns={columns(false)} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/lab/requests/${r.id}`)} />}</QueryBoundary>
      )}
    </>
  );
}
