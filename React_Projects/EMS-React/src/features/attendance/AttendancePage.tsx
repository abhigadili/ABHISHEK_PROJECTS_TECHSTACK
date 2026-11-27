import { Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { AttendanceWidget } from './AttendanceWidget';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DashboardCard } from '@/components/common/DashboardCard';
import { useAttendanceSummaryQuery, useListAttendanceQuery } from '@/store/api/emsApi';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useDepartmentFilter, useDepartments } from '@/hooks/useDepartments';
import { errorMessage } from '@/api/errors';
import { endOfMonth, formatDate, formatHours, formatTime, humanize, startOfMonth } from '@/utils/format';
import type { AttendanceRecord, AttendanceStatus } from '@/types/api';

const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'].map((v) => ({
  value: v,
  label: humanize(v),
}));

export default function AttendancePage() {
  const navigate = useNavigate();
  const { isManagerUp, can } = usePermissions();
  const [sp, setSp] = useSearchParams(); // date range + scope live in the URL → shareable / survives refresh
  const now = new Date();
  const from = sp.get('from') ?? startOfMonth(now.getFullYear(), now.getMonth() + 1);
  const to = sp.get('to') ?? endOfMonth(now.getFullYear(), now.getMonth() + 1);
  const scope = (sp.get('scope') as 'me' | 'all') ?? 'me';
  const status = (sp.get('status') ?? '') as AttendanceStatus | '';
  const [deptFilter, setDeptFilter] = useDepartmentFilter();
  const { options } = useDepartments({ skip: !isManagerUp }); // only managers+ get the department filter
  const pg = usePagination();
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);
  useEffect(() => {
    pg.reset();
  }, [from, to, scope, status, deptFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Record<string, string>) =>
    setSp(
      (p) => {
        const n = new URLSearchParams(p);
        Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
        return n;
      },
      { replace: true },
    );
  const effectiveScope = isManagerUp ? scope : 'me';

  const list = useListAttendanceQuery({
    scope: effectiveScope,
    from,
    to,
    status: status || undefined,
    departmentId: effectiveScope === 'all' ? (deptFilter ?? undefined) : undefined,
    page: pg.page,
    limit: pg.limit,
  });
  const summary = useAttendanceSummaryQuery({ from, to });

  const columns = useMemo<Column<AttendanceRecord>[]>(
    () => [
      { key: 'workDate', header: 'Date', render: (r) => formatDate(r.workDate) },
      ...(effectiveScope === 'all'
        ? [
            { key: 'employeeName', header: 'Employee' } as Column<AttendanceRecord>,
            {
              key: 'dept',
              header: 'Department',
              hideBelow: 'md',
              render: (r: AttendanceRecord) => r.department?.name ?? '—',
            } as Column<AttendanceRecord>,
          ]
        : []),
      { key: 'checkInAt', header: 'In', render: (r) => formatTime(r.checkInAt) },
      { key: 'checkOutAt', header: 'Out', render: (r) => formatTime(r.checkOutAt) },
      { key: 'workingHours', header: 'Hours', hideBelow: 'sm', render: (r) => formatHours(r.workingHours) },
      {
        key: 'workMode',
        header: 'Mode',
        hideBelow: 'md',
        render: (r) => (r.workMode ? humanize(r.workMode) : '—'),
      },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ],
    [effectiveScope],
  );

  const s = summary.data;
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <>
            <Button component={RouterLink} to="/attendance/calendar" variant="outlined">
              Calendar
            </Button>
            {can('attendance:view-reports') && (
              <Button component={RouterLink} to="/attendance/reports" variant="outlined">
                Reports
              </Button>
            )}
          </>
        }
      />
      <Stack spacing={2}>
        <AttendanceWidget />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
          <DashboardCard title="Present days" value={s?.byStatus.PRESENT ?? 0} loading={summary.isLoading} />
          <DashboardCard
            title="Half days"
            value={s?.byStatus.HALF_DAY ?? 0}
            loading={summary.isLoading}
            color="warning.main"
          />
          <DashboardCard
            title="On leave"
            value={s?.byStatus.ON_LEAVE ?? 0}
            loading={summary.isLoading}
            color="info.main"
          />
          <DashboardCard
            title="Hours worked"
            value={s ? s.totalHours.toFixed(1) : 0}
            loading={summary.isLoading}
          />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            type="date"
            label="From"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            onBlur={() => localFrom && set({ from: localFrom })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ maxWidth: 190 }}
          />
          <TextField
            type="date"
            label="To"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            onBlur={() => localTo && set({ to: localTo })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ maxWidth: 190 }}
          />
          <FilterSelect
            label="Status"
            value={status}
            options={STATUSES}
            onChange={(v) => set({ status: v })}
            minWidth={150}
          />
          {isManagerUp && (
            <>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={effectiveScope}
                onChange={(_, v) => v && set({ scope: v })}
                aria-label="Scope"
              >
                <ToggleButton value="me">My records</ToggleButton>
                <ToggleButton value="all">Team / all</ToggleButton>
              </ToggleButtonGroup>
              {effectiveScope === 'all' && (
                <FilterSelect
                  label="Department"
                  value={deptFilter ? String(deptFilter) : ''}
                  options={options}
                  onChange={(v) => setDeptFilter(v ? Number(v) : null)}
                />
              )}
            </>
          )}
        </Stack>
        <DataTable<AttendanceRecord>
          caption="Attendance records"
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(r) => r.id}
          loading={list.isLoading || list.isFetching}
          error={list.isError ? errorMessage(list.error) : null}
          onRetry={list.refetch}
          onRowClick={(r) => navigate(`/attendance/${r.id}`)}
          emptyTitle="No attendance in this range"
          emptyDescription="Check in from the card above, or widen the dates."
          pagination={
            list.data
              ? {
                  page: list.data.meta.page,
                  limit: list.data.meta.limit,
                  total: list.data.meta.total,
                  onPage: pg.setPage,
                  onLimit: pg.setLimit,
                }
              : undefined
          }
        />
        <Typography variant="caption" color="text.secondary">
          Filters are kept in the URL, so you can bookmark or share this exact view.
        </Typography>
      </Stack>
    </>
  );
}
