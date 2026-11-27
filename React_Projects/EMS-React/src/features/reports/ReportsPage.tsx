import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { SearchBox } from '@/components/tables/SearchBox';
import { VirtualList } from '@/components/common/VirtualList';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { Can } from '@/components/common/Can';
import {
  useDepartmentsReportQuery,
  useDesignationsReportQuery,
  useJoinersExitsReportQuery,
  useLeaveBalanceReportQuery,
  useLeaveSummaryReportQuery,
} from '@/store/api/emsApi';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { downloadCsv, saveBlob } from '@/services/reportApi';
import { employeeApi } from '@/services/employeeApi';
import { toCsv } from '@/utils/csv';
import { errorMessage } from '@/api/errors';
import { formatDate, humanize, today } from '@/utils/format';
import type { DepartmentReportRow, DesignationReportRow, JoinersExits } from '@/types/api';

type TabKey = 'headcount' | 'joiners' | 'leave-balances' | 'leave-summary' | 'employees';

export default function ReportsPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<TabKey>('headcount');
  const [isPending, startTransition] = useTransition(); // switching tabs is non-urgent: keep the old tab interactive while the new one renders
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Headcount, joiners & leavers, leave and employee directory exports"
      />
      <Tabs
        value={tab}
        onChange={(_, v) => startTransition(() => setTab(v))}
        variant="scrollable"
        sx={{ mb: 2 }}
      >
        <Tab value="headcount" label="Headcount" disabled={!can('reports:admin')} />
        <Tab value="joiners" label="Joiners & leavers" />
        <Tab value="leave-balances" label="Leave balances" />
        <Tab value="leave-summary" label="Leave summary" />
        <Tab value="employees" label="Employee directory" />
      </Tabs>
      <Box sx={{ opacity: isPending ? 0.6 : 1, transition: 'opacity .15s' }}>
        {tab === 'headcount' && (
          <Can
            permission="reports:admin"
            fallback={<Alert severity="info">Headcount reports are available to HR admins.</Alert>}
          >
            <HeadcountReport />
          </Can>
        )}
        {tab === 'joiners' && <JoinersReport />}
        {tab === 'leave-balances' && <LeaveBalancesReport />}
        {tab === 'leave-summary' && <LeaveSummaryReport />}
        {tab === 'employees' && <EmployeeDirectoryReport />}
      </Box>
    </>
  );
}

function CsvButton({
  path,
  params,
  filename,
  label = 'Export CSV',
}: {
  path: string;
  params?: Record<string, string | number | undefined>;
  filename: string;
  label?: string;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      saveBlob(await downloadCsv(path, params), filename);
    } catch (e) {
      notify.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={run} disabled={busy}>
      {label}
    </Button>
  );
}

const Block = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <Stack spacing={2}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h6">{title}</Typography>
      {action}
    </Stack>
    {children}
  </Stack>
);

function HeadcountReport() {
  const dept = useDepartmentsReportQuery();
  const desig = useDesignationsReportQuery();
  const total = useMemo(() => (dept.data ?? []).reduce((a, d) => a + d.activeEmployees, 0), [dept.data]);
  const dCols: Column<DepartmentReportRow>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Department' },
    { key: 'head', header: 'Head', hideBelow: 'sm', render: (r) => r.head ?? '—' },
    { key: 'activeEmployees', header: 'Active', align: 'right' },
    { key: 'inactiveEmployees', header: 'Inactive', align: 'right', hideBelow: 'sm' },
    { key: 'teams', header: 'Teams', align: 'right', hideBelow: 'md' },
  ];
  const gCols: Column<DesignationReportRow>[] = [
    { key: 'name', header: 'Designation' },
    { key: 'jobLevel', header: 'Level', align: 'right', render: (r) => `L${r.jobLevel}` },
    { key: 'activeEmployees', header: 'Active employees', align: 'right' },
  ];
  return (
    <Stack spacing={4}>
      <Block
        title={`Employee headcount by department (${total} active)`}
        action={<CsvButton path="/reports/departments" filename="headcount-departments.csv" />}
      >
        <DataTable<DepartmentReportRow>
          caption="Department headcount"
          columns={dCols}
          rows={dept.data ?? []}
          getRowId={(r) => r.code}
          loading={dept.isLoading}
          error={dept.isError ? errorMessage(dept.error) : null}
          onRetry={dept.refetch}
        />
      </Block>
      <Block
        title="Headcount by designation"
        action={<CsvButton path="/reports/designations" filename="headcount-designations.csv" />}
      >
        <DataTable<DesignationReportRow>
          caption="Designation headcount"
          columns={gCols}
          rows={desig.data ?? []}
          getRowId={(r) => r.name}
          loading={desig.isLoading}
          error={desig.isError ? errorMessage(desig.error) : null}
          onRetry={desig.refetch}
        />
      </Block>
    </Stack>
  );
}

function DateRange({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <Stack direction="row" spacing={2}>
      <TextField
        type="date"
        label="From"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ maxWidth: 190 }}
      />
      <TextField
        type="date"
        label="To"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ maxWidth: 190 }}
      />
    </Stack>
  );
}

function JoinersReport() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today());
  const { data, isLoading, isFetching, isError, error, refetch } = useJoinersExitsReportQuery({ from, to });
  const pg = usePagination({ initialLimit: 10 });
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const all = [
      ...(data?.joiners ?? []).map((j) => ({ ...j, kind: 'JOINED' })),
      ...(data?.exits ?? []).map((x) => ({ ...x, employmentType: '', kind: 'EXITED' })),
    ];
    return all
      .filter(
        (r) =>
          !q || `${r.name} ${r.employeeCode} ${r.department ?? ''}`.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, q]);
  type Row = ReturnType<
    typeof useMemo<
      {
        name: string;
        employeeCode: string;
        department: string | null;
        date: string;
        kind: string;
        employmentType: string;
      }[]
    >
  >[number];
  const paged = rows.slice((pg.page - 1) * pg.limit, pg.page * pg.limit);
  const cols: Column<Row>[] = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'kind', header: 'Event', render: (r) => (r.kind === 'JOINED' ? 'Joined' : 'Left') },
    { key: 'name', header: 'Employee' },
    { key: 'employeeCode', header: 'Code', hideBelow: 'sm' },
    { key: 'department', header: 'Department', hideBelow: 'md', render: (r) => r.department ?? '—' },
    {
      key: 'employmentType',
      header: 'Type',
      hideBelow: 'md',
      render: (r) => (r.employmentType ? humanize(r.employmentType) : '—'),
    },
  ];
  const joiners = data as JoinersExits | undefined;
  return (
    <Block title={`Joiners (${joiners?.joiners.length ?? 0}) and leavers (${joiners?.exits.length ?? 0})`}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <DateRange
          from={from}
          to={to}
          setFrom={(v) => {
            setFrom(v);
            pg.reset();
          }}
          setTo={(v) => {
            setTo(v);
            pg.reset();
          }}
        />
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            pg.reset();
          }}
          placeholder="Name, code or department"
        />
      </Stack>
      <DataTable
        columns={cols}
        rows={paged}
        getRowId={(r) => `${r.kind}-${r.employeeCode}-${r.date}`}
        caption="Joiners and leavers"
        loading={isLoading || isFetching}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        emptyTitle="No joiners or leavers in this range"
        pagination={{
          page: pg.page,
          limit: pg.limit,
          total: rows.length,
          onPage: pg.setPage,
          onLimit: pg.setLimit,
        }}
      />
    </Block>
  );
}

function LeaveBalancesReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading, isError, error, refetch } = useLeaveBalanceReportQuery({ year });
  const [q, setQ] = useState('');
  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) => !q || `${r.name} ${r.employeeCode} ${r.leaveType}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [data, q],
  );
  return (
    <Block
      title="Leave balances"
      action={
        <CsvButton path="/reports/leave-balances" params={{ year }} filename={`leave-balances-${year}.csv`} />
      }
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          type="number"
          label="Year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ maxWidth: 120 }}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Name, code or leave type" />
      </Stack>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorMessage message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            {/* virtualised: rows = employees × leave types, which can reach thousands; only ~12 DOM rows exist at any time */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                px: 2,
                py: 1,
                fontWeight: 700,
                borderBottom: 1,
                borderColor: 'divider',
                fontSize: 14,
              }}
            >
              <span>Employee</span>
              <span>Type</span>
              <span style={{ textAlign: 'right' }}>Entitled</span>
              <span style={{ textAlign: 'right' }}>Adjusted</span>
              <span style={{ textAlign: 'right' }}>Used</span>
              <span style={{ textAlign: 'right' }}>Available</span>
            </Box>
            {rows.length === 0 ? (
              <Typography sx={{ p: 2 }} color="text.secondary">
                No rows.
              </Typography>
            ) : (
              <VirtualList
                items={rows}
                rowHeight={40}
                height={Math.min(rows.length, 10) * 40}
                getKey={(r, i) => `${r.employeeCode}-${r.leaveType}-${i}`}
                renderRow={(r) => (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                      px: 2,
                      alignItems: 'center',
                      height: 40,
                      fontSize: 14,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <span>
                      {r.name}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {r.employeeCode}
                      </Typography>
                    </span>
                    <span>{r.leaveType}</span>
                    <span style={{ textAlign: 'right' }}>{r.entitled}</span>
                    <span style={{ textAlign: 'right' }}>{r.adjusted}</span>
                    <span style={{ textAlign: 'right' }}>{r.used}</span>
                    <b style={{ textAlign: 'right' }}>{r.available}</b>
                  </Box>
                )}
              />
            )}
          </CardContent>
        </Card>
      )}
      <Typography variant="caption" color="text.secondary">
        {rows.length} rows
      </Typography>
    </Block>
  );
}

function LeaveSummaryReport() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today());
  const { data, isLoading, isError, error, refetch } = useLeaveSummaryReportQuery({ from, to });
  const keys = useMemo(() => Object.keys(data?.rows[0] ?? {}), [data]);
  const cols: Column<Record<string, string | number | null>>[] = keys.map((k) => ({
    key: k,
    header: humanize(k.replace(/([A-Z])/g, '_$1')),
  }));
  return (
    <Block
      title="Leave summary"
      action={<CsvButton path="/reports/leave-summary" params={{ from, to }} filename="leave-summary.csv" />}
    >
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <DataTable
        columns={cols}
        rows={data?.rows ?? []}
        getRowId={(r) => JSON.stringify(r)}
        caption="Leave summary"
        loading={isLoading}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        emptyTitle="No leave in this range"
      />
    </Block>
  );
}

/** No server-side employee CSV exists, so this export pages through GET /employees and builds the file in the browser. */
function EmployeeDirectoryReport() {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const exportAll = async () => {
    setBusy(true);
    setStatus('Collecting employees…');
    try {
      const all = [];
      for (let page = 1; page <= 100; page += 1) {
        const res = await employeeApi.list({ page, limit: 100, status: 'ALL' });
        all.push(...res.items);
        setStatus(`Collected ${all.length} of ${res.meta.total}`);
        if (page >= res.meta.totalPages) break;
      }
      const rows = all.map((e) => ({
        code: e.employeeCode,
        name: e.fullName,
        email: e.workEmail,
        department: e.department?.name ?? '',
        designation: e.designation?.name ?? '',
        title: e.jobTitle ?? '',
        manager: e.manager?.name ?? '',
        status: e.status,
        type: e.employmentType,
        joined: e.joiningDate,
      }));
      const cols = (
        [
          'code',
          'name',
          'email',
          'department',
          'designation',
          'title',
          'manager',
          'status',
          'type',
          'joined',
        ] as const
      ).map((k) => ({ key: k, header: k }));
      saveBlob(new Blob([toCsv(rows, cols)], { type: 'text/csv;charset=utf-8' }), 'employees.csv');
      setStatus(`Exported ${rows.length} employees`);
    } catch (e) {
      notify.error(errorMessage(e));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Block title="Employee directory export">
      <Alert severity="info">
        Exports every employee you are allowed to see (status: all) as CSV. Built in the browser from the
        paged employee API.
      </Alert>
      <Box>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportAll} disabled={busy}>
          Export employees (CSV)
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {status}
      </Typography>
    </Block>
  );
}
