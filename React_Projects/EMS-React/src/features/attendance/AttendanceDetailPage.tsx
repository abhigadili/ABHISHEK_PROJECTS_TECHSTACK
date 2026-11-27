import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCorrectAttendanceMutation, useGetAttendanceQuery } from '@/store/api/emsApi';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/dialogs/Modal';
import { FormSelect, FormTextField } from '@/components/forms/fields';
import { Can } from '@/components/common/Can';
import { attendanceCorrectionSchema, type AttendanceCorrectionValues } from '@/schemas/leaveAttendance';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage } from '@/api/errors';
import {
  formatDate,
  formatDateTime,
  formatHours,
  fromDateTimeLocal,
  humanize,
  toDateTimeLocal,
} from '@/utils/format';
import type { AttendanceRecord } from '@/types/api';

export default function AttendanceDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useGetAttendanceQuery(id);
  const [open, setOpen] = useState(false);
  if (isLoading) return <Loading page />;
  if (isError || !data) return <ErrorMessage message={errorMessage(error)} onRetry={refetch} />;
  return (
    <>
      <PageHeader
        title={`Attendance · ${formatDate(data.workDate)}`}
        subtitle={`${data.employeeName} (${data.employeeCode})`}
        actions={
          <>
            <Button onClick={() => navigate(-1)}>Back</Button>
            <Can permission="attendance:correct">
              <Button variant="contained" onClick={() => setOpen(true)}>
                Correct record
              </Button>
            </Can>
          </>
        }
      />
      <Card>
        <CardContent>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
            <Item label="Status">
              <StatusBadge status={data.status} />
            </Item>
            <Item label="Work mode">{data.workMode ? humanize(data.workMode) : '—'}</Item>
            <Item label="Department">{data.department?.name ?? '—'}</Item>
            <Item label="Check-in">{formatDateTime(data.checkInAt)}</Item>
            <Item label="Check-out">{formatDateTime(data.checkOutAt)}</Item>
            <Item label="Working hours">{formatHours(data.workingHours)}</Item>
            <Item label="Remarks">{data.remarks ?? '—'}</Item>
          </Box>
        </CardContent>
      </Card>
      <CorrectionDialog open={open} record={data} onClose={() => setOpen(false)} />
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

function CorrectionDialog({
  open,
  record,
  onClose,
}: {
  open: boolean;
  record: AttendanceRecord;
  onClose: () => void;
}) {
  const [correct, { isLoading }] = useCorrectAttendanceMutation();
  const notify = useNotify();
  const methods = useForm<AttendanceCorrectionValues>({
    resolver: zodResolver(attendanceCorrectionSchema),
    values: {
      checkInAt: toDateTimeLocal(record.checkInAt),
      checkOutAt: toDateTimeLocal(record.checkOutAt),
      status: record.status,
      workMode: record.workMode ?? 'OFFICE',
      reason: '',
    },
  });
  const submit = methods.handleSubmit(async (v) => {
    try {
      await correct({
        id: record.id,
        body: {
          checkInAt: fromDateTimeLocal(v.checkInAt),
          checkOutAt: fromDateTimeLocal(v.checkOutAt),
          status: v.status,
          workMode: v.workMode,
          reason: v.reason,
        },
      }).unwrap();
      notify.success('Attendance corrected');
      onClose();
    } catch (e) {
      notify.error(errorMessage(e));
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct attendance"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={isLoading}>
            Save correction
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormTextField<AttendanceCorrectionValues>
            name="checkInAt"
            label="Check-in"
            type="datetime-local"
          />
          <FormTextField<AttendanceCorrectionValues>
            name="checkOutAt"
            label="Check-out"
            type="datetime-local"
          />
          <FormSelect<AttendanceCorrectionValues>
            name="status"
            label="Status"
            options={['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'].map((v) => ({
              value: v,
              label: humanize(v),
            }))}
          />
          <FormSelect<AttendanceCorrectionValues>
            name="workMode"
            label="Work mode"
            options={['OFFICE', 'REMOTE', 'HYBRID'].map((v) => ({ value: v, label: humanize(v) }))}
          />
          <FormTextField<AttendanceCorrectionValues>
            name="reason"
            label="Reason for correction"
            multiline
            rows={2}
            required
            helperText="Recorded in the audit log"
          />
        </Stack>
      </FormProvider>
    </Modal>
  );
}
