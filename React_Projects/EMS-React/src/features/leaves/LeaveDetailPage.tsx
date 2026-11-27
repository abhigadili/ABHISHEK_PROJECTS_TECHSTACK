import { Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCancelLeaveMutation, useDecideLeaveMutation, useGetLeaveRequestQuery } from '@/store/api/emsApi';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { downloadDocument } from './downloadDocument';
import { errorMessage } from '@/api/errors';
import { formatDate, formatDateTime, humanize } from '@/utils/format';

export default function LeaveDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { data, isLoading, isError, error, refetch } = useGetLeaveRequestQuery(id);
  const [decide, { isLoading: deciding }] = useDecideLeaveMutation();
  const [cancel, { isLoading: cancelling }] = useCancelLeaveMutation();
  const [note, setNote] = useState('');

  if (isLoading) return <Loading page />;
  if (isError || !data) return <ErrorMessage message={errorMessage(error)} onRetry={refetch} />;

  const own = data.employeeId === user?.employeeId;
  const canDecide = can('leave:approve') && !own && data.status === 'PENDING'; // the backend also forbids deciding your own request
  const canCancel =
    (own || can('leave:administer')) && (data.status === 'PENDING' || data.status === 'APPROVED');

  const act = async (action: 'approve' | 'reject') => {
    try {
      await decide({ id, action, note: note.trim() || undefined }).unwrap();
      notify.success(action === 'approve' ? 'Leave approved' : 'Leave rejected');
      setNote('');
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };
  const doCancel = async () => {
    if (
      !(await confirm({
        title: 'Cancel this request?',
        message: 'Any balance held for it will be released.',
        confirmLabel: 'Cancel request',
        cancelLabel: 'Keep',
        destructive: true,
      }))
    )
      return;
    try {
      await cancel(id).unwrap();
      notify.success('Leave cancelled');
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title={`${data.leaveType.name} · ${data.days} day${data.days === 1 ? '' : 's'}`}
        subtitle={`${data.employeeName} (${data.employeeCode})`}
        actions={
          <>
            <Button onClick={() => navigate(-1)}>Back</Button>
            {canCancel && (
              <Button color="error" variant="outlined" onClick={doCancel} disabled={cancelling}>
                Cancel request
              </Button>
            )}
          </>
        }
      />
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' } }}
            >
              <Item label="Status">
                <StatusBadge status={data.status} />
              </Item>
              <Item label="From">{formatDate(data.startDate)}</Item>
              <Item label="To">{formatDate(data.endDate)}</Item>
              <Item label="Day part">{humanize(data.dayPart)}</Item>
              <Item label="Submitted">{formatDateTime(data.createdAt)}</Item>
              <Item label="Decided">{data.decidedAt ? formatDateTime(data.decidedAt) : '—'}</Item>
            </Box>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Reason
            </Typography>
            <Typography>{data.reason}</Typography>
            {data.decisionNote && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2 }}>
                  Decision note
                </Typography>
                <Typography>{data.decisionNote}</Typography>
              </>
            )}
          </CardContent>
        </Card>
        {(data.documents?.length ?? 0) > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Documents
              </Typography>
              {data.documents!.map((d) => (
                <Typography key={d.id}>
                  <Link
                    component="button"
                    onClick={() =>
                      downloadDocument(data.id, d.id, d.fileName).catch((e) => notify.error(errorMessage(e)))
                    }
                  >
                    {d.fileName}
                  </Link>{' '}
                  · {(d.sizeBytes / 1024).toFixed(0)} KB
                </Typography>
              ))}
            </CardContent>
          </Card>
        )}
        {canDecide && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Decision
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  multiline
                  rows={2}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={deciding}
                    onClick={() => act('approve')}
                  >
                    Approve
                  </Button>
                  <Button variant="outlined" color="error" disabled={deciding} onClick={() => act('reject')}>
                    Reject
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </>
  );
}

const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Stack>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography component="div">{children}</Typography>
  </Stack>
);
