import { Box, Button, Stack, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { DashboardCard } from '@/components/common/DashboardCard';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { Can } from '@/components/common/Can';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { useCancelLeaveMutation, useListLeaveRequestsQuery } from '@/store/api/emsApi';
import { useLeave } from '@/hooks/useLeave';
import { usePagination } from '@/hooks/usePagination';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage } from '@/api/errors';
import { formatDate, humanize } from '@/utils/format';
import type { LeaveRequest, LeaveStatus } from '@/types/api';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((v) => ({
  value: v,
  label: humanize(v),
}));

export default function LeavePage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();
  const {
    year,
    setYear,
    statusFilter,
    setStatusFilter,
    balances,
    isLoading: balLoading,
    isError: balError,
  } = useLeave();
  const pg = usePagination();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const list = useListLeaveRequestsQuery({
    scope: 'me',
    from,
    to,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    page: pg.page,
    limit: pg.limit,
  });
  const [cancel] = useCancelLeaveMutation();

  const doCancel = useCallback(
    async (r: LeaveRequest) => {
      if (
        !(await confirm({
          title: 'Cancel this leave request?',
          message: `${r.leaveType.name}, ${formatDate(r.startDate)} – ${formatDate(r.endDate)}`,
          confirmLabel: 'Cancel request',
          cancelLabel: 'Keep',
          destructive: true,
        }))
      )
        return;
      try {
        await cancel(r.id).unwrap();
        notify.success('Leave request cancelled');
      } catch (e) {
        notify.error(errorMessage(e));
      }
    },
    [cancel, confirm, notify],
  );

  const columns = useMemo<Column<LeaveRequest>[]>(
    () => [
      { key: 'leaveType', header: 'Type', render: (r) => r.leaveType.name },
      {
        key: 'dates',
        header: 'Dates',
        render: (r) =>
          `${formatDate(r.startDate)}${r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ''}`,
      },
      { key: 'days', header: 'Days', align: 'right' },
      { key: 'reason', header: 'Reason', hideBelow: 'md' },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      {
        key: 'actions',
        header: '',
        render: (r) =>
          (r.status === 'PENDING' || r.status === 'APPROVED') &&
          new Date(r.endDate) >= new Date(new Date().toDateString()) ? (
            <Button
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                void doCancel(r);
              }}
            >
              Cancel
            </Button>
          ) : null,
      },
    ],
    [doCancel],
  );

  return (
    <>
      <PageHeader
        title="My leave"
        subtitle={`Balances and history for ${year}`}
        actions={
          <>
            <Button component={RouterLink} to="/leaves/apply" variant="contained">
              Apply for leave
            </Button>
            <Button component={RouterLink} to="/leaves/calendar" variant="outlined">
              Calendar
            </Button>
            <Can roles={['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN']}>
              <Button component={RouterLink} to="/leaves/approvals" variant="outlined">
                Approvals
              </Button>
            </Can>
            <Can permission="leave:administer">
              <Button component={RouterLink} to="/leaves/admin" variant="outlined">
                Administration
              </Button>
            </Can>
          </>
        }
      />
      {balLoading ? (
        <Loading />
      ) : balError ? (
        <ErrorMessage message="Could not load balances." />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            mb: 3,
          }}
        >
          {balances.map((b) => (
            <DashboardCard
              key={b.leaveTypeId}
              title={b.leaveTypeName}
              value={b.available}
              hint={`${b.used} used · ${b.entitled + b.adjusted} total`}
            />
          ))}
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          type="number"
          label="Year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ maxWidth: 120 }}
        />
        <FilterSelect
          label="Status"
          value={statusFilter === 'ALL' ? '' : statusFilter}
          options={STATUSES}
          onChange={(v) => {
            setStatusFilter((v || 'ALL') as LeaveStatus | 'ALL');
            pg.reset();
          }}
        />
      </Stack>
      <DataTable<LeaveRequest>
        caption="Leave requests"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(r) => r.id}
        loading={list.isLoading || list.isFetching}
        error={list.isError ? errorMessage(list.error) : null}
        onRetry={list.refetch}
        onRowClick={(r) => navigate(`/leaves/${r.id}`)}
        emptyTitle="No leave requests"
        emptyDescription="Apply for leave to see it here."
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
    </>
  );
}
