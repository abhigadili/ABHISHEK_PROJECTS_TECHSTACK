import { Box, Button, Stack, Tab, Tabs, TextField } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useMemo, useState, useTransition } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { SearchBox } from '@/components/tables/SearchBox';
import { useDepartmentAttendanceReportQuery, useMonthlyAttendanceReportQuery } from '@/store/api/emsApi';
import { useDepartmentFilter, useDepartments } from '@/hooks/useDepartments';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { downloadCsv, saveBlob } from '@/services/reportApi';
import { errorMessage } from '@/api/errors';
import { endOfMonth, formatHours, startOfMonth } from '@/utils/format';
import type { DepartmentAttendanceRow, MonthlyAttendanceRow } from '@/types/api';

export default function AttendanceReportsPage() {
  const now = new Date();
  const { can } = usePermissions();
  const notify = useNotify();
  const [tab, setTab] = useState<'monthly' | 'department'>('monthly');
  const [isPending, startTransition] = useTransition(); // switching report tabs is a non-urgent update
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [deptFilter, setDeptFilter] = useDepartmentFilter();
  const { options } = useDepartments();
  const [search, setSearch] = useState('');
  const monthly = useMonthlyAttendanceReportQuery({ year, month, departmentId: deptFilter ?? undefined });
  const dept = useDepartmentAttendanceReportQuery(
    { from: startOfMonth(year, month), to: endOfMonth(year, month) },
    { skip: !can('attendance:view-department-report') },
  );

  const rows = useMemo(
    () =>
      (monthly.data?.rows ?? []).filter(
        (r) => !search || `${r.employeeName} ${r.employeeCode}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [monthly.data, search],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          present: a.present + r.present,
          halfDay: a.halfDay + r.halfDay,
          absent: a.absent + r.absent,
          hours: a.hours + r.totalHours,
        }),
        { present: 0, halfDay: 0, absent: 0, hours: 0 },
      ),
    [rows],
  );

  const exportCsv = async () => {
    try {
      const blob =
        tab === 'monthly'
          ? await downloadCsv('/attendance/reports/monthly', {
              year,
              month,
              departmentId: deptFilter ?? undefined,
            })
          : await downloadCsv('/attendance/reports/department', {
              from: startOfMonth(year, month),
              to: endOfMonth(year, month),
            });
      saveBlob(blob, `attendance-${tab}-${year}-${String(month).padStart(2, '0')}.csv`);
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };

  const mCols: Column<MonthlyAttendanceRow>[] = [
    { key: 'employeeName', header: 'Employee' },
    { key: 'department', header: 'Department', hideBelow: 'md', render: (r) => r.department ?? '—' },
    { key: 'present', header: 'Present', align: 'right' },
    { key: 'halfDay', header: 'Half', align: 'right' },
    { key: 'absent', header: 'Absent', align: 'right' },
    { key: 'onLeave', header: 'Leave', align: 'right', hideBelow: 'sm' },
    { key: 'totalHours', header: 'Hours', align: 'right', render: (r) => formatHours(r.totalHours) },
  ];
  const dCols: Column<DepartmentAttendanceRow>[] = [
    { key: 'department', header: 'Department' },
    { key: 'headcount', header: 'Headcount', align: 'right' },
    { key: 'present', header: 'Present', align: 'right' },
    { key: 'halfDay', header: 'Half', align: 'right' },
    { key: 'absent', header: 'Absent', align: 'right' },
    { key: 'onLeave', header: 'Leave', align: 'right' },
    { key: 'totalHours', header: 'Hours', align: 'right', render: (r) => formatHours(r.totalHours) },
  ];

  return (
    <>
      <PageHeader
        title="Attendance reports"
        actions={
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <Tabs value={tab} onChange={(_, v) => startTransition(() => setTab(v))} sx={{ mb: 2 }}>
        <Tab value="monthly" label="Monthly by employee" />
        {can('attendance:view-department-report') && <Tab value="department" label="By department" />}
      </Tabs>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          type="number"
          label="Year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ maxWidth: 120 }}
        />
        <FilterSelect
          label="Month"
          value={String(month)}
          allLabel=""
          options={Array.from({ length: 12 }, (_, i) => ({
            value: String(i + 1),
            label: new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }),
          }))}
          onChange={(v) => v && setMonth(Number(v))}
          minWidth={150}
        />
        {tab === 'monthly' && (
          <>
            <FilterSelect
              label="Department"
              value={deptFilter ? String(deptFilter) : ''}
              options={options}
              onChange={(v) => setDeptFilter(v ? Number(v) : null)}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Employee" />
          </>
        )}
      </Stack>
      <Box sx={{ opacity: isPending ? 0.6 : 1 }}>
        {tab === 'monthly' ? (
          <>
            <DataTable<MonthlyAttendanceRow>
              caption="Monthly attendance report"
              columns={mCols}
              rows={rows}
              getRowId={(r) => r.employeeId}
              loading={monthly.isLoading || monthly.isFetching}
              error={monthly.isError ? errorMessage(monthly.error) : null}
              onRetry={monthly.refetch}
              emptyTitle="No data for this month"
            />
            <Box sx={{ mt: 1, color: 'text.secondary', fontSize: 14 }} data-testid="attendance-totals">
              Totals — present {totals.present}, half-days {totals.halfDay}, absent {totals.absent},{' '}
              {totals.hours.toFixed(1)} h
            </Box>
          </>
        ) : (
          <DataTable<DepartmentAttendanceRow>
            caption="Department attendance report"
            columns={dCols}
            rows={dept.data?.rows ?? []}
            getRowId={(r) => r.departmentId}
            loading={dept.isLoading}
            error={dept.isError ? errorMessage(dept.error) : null}
            onRetry={dept.refetch}
            emptyTitle="No data"
          />
        )}
      </Box>
    </>
  );
}
