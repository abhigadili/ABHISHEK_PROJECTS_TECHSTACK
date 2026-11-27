import { Alert, Button, Stack, TextField } from '@mui/material';
import { useOptimistic, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/dialogs/Modal';
import { useDecideLeaveMutation, useListLeaveRequestsQuery } from '@/store/api/emsApi';
import { useModal } from '@/hooks/useModal';
import { usePagination } from '@/hooks/usePagination';
import { useNotify } from '@/contexts/NotificationContext';
import { useAppDispatch } from '@/app/store/hooks';
import { refreshUnreadCount } from '@/store/slices/notificationSlice';
import { errorMessage } from '@/api/errors';
import { formatDate } from '@/utils/format';
import type { LeaveRequest } from '@/types/api';

/** Manager approval dashboard: PENDING requests of people in your scope. */
export default function LeaveApprovalsPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const dispatch = useAppDispatch();
  const pg = usePagination();
  const { data, isLoading, isFetching, isError, error, refetch } = useListLeaveRequestsQuery({
    scope: 'pending',
    page: pg.page,
    limit: pg.limit,
  });
  const [decide] = useDecideLeaveMutation();
  const modal = useModal<{ request: LeaveRequest; action: 'approve' | 'reject' }>();
  const [note, setNote] = useState('');
  const [, startTransition] = useTransition();

  // useOptimistic: a decided row disappears from the list IMMEDIATELY; if the server refuses, React snaps it back automatically
  const [rows, removeOptimistically] = useOptimistic(data?.items ?? [], (current, removedId: number) =>
    current.filter((r) => r.id !== removedId),
  );

  const confirmDecision = () => {
    const ctx = modal.data;
    if (!ctx) return;
    modal.close();
    startTransition(async () => {
      removeOptimistically(ctx.request.id);
      try {
        await decide({ id: ctx.request.id, action: ctx.action, note: note.trim() || undefined }).unwrap();
        notify.success(ctx.action === 'approve' ? 'Leave approved' : 'Leave rejected');
        void dispatch(refreshUnreadCount());
      } catch (e) {
        notify.error(errorMessage(e));
      }
      setNote('');
    });
  };

  const columns: Column<LeaveRequest>[] = [
    { key: 'employeeName', header: 'Employee' },
    { key: 'leaveType', header: 'Type', render: (r) => r.leaveType.name },
    { key: 'dates', header: 'Dates', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
    { key: 'days', header: 'Days', align: 'right' },
    { key: 'reason', header: 'Reason', hideBelow: 'md' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
          <Button size="small" color="success" onClick={() => modal.open({ request: r, action: 'approve' })}>
            Approve
          </Button>
          <Button size="small" color="error" onClick={() => modal.open({ request: r, action: 'reject' })}>
            Reject
          </Button>
        </Stack>
      ),
    },
  ];

  const action = modal.data?.action;
  return (
    <>
      <PageHeader title="Leave approvals" subtitle={data ? `${data.meta.total} pending` : undefined} />
      <Alert severity="info" sx={{ mb: 2 }}>
        You can't approve your own requests; the server enforces this too.
      </Alert>
      <DataTable<LeaveRequest>
        caption="Pending leave requests"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={isLoading || isFetching}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/leaves/${r.id}`)}
        emptyTitle="Nothing waiting for approval"
        pagination={
          data
            ? {
                page: data.meta.page,
                limit: data.meta.limit,
                total: data.meta.total,
                onPage: pg.setPage,
                onLimit: pg.setLimit,
              }
            : undefined
        }
      />
      <Modal
        open={modal.isOpen}
        onClose={modal.close}
        title={action === 'approve' ? 'Approve leave' : 'Reject leave'}
        maxWidth="xs"
        actions={
          <>
            <Button onClick={modal.close}>Cancel</Button>
            <Button
              variant="contained"
              color={action === 'approve' ? 'success' : 'error'}
              onClick={confirmDecision}
            >
              {action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <TextField
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          rows={3}
          autoFocus
        />
      </Modal>
    </>
  );
}
