import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { FormSelect, FormTextField } from '@/components/forms/fields';
import { FileUpload, type FileUploadHandle } from '@/components/common/FileUpload';
import { useApplyLeaveMutation } from '@/store/api/emsApi';
import { useLeave } from '@/hooks/useLeave';
import { leaveApi } from '@/services/leaveApi';
import { leaveApplicationSchema, type LeaveApplicationValues } from '@/schemas/leaveAttendance';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage } from '@/api/errors';
import { humanize, today } from '@/utils/format';

/** Whole calendar days between two YYYY-MM-DD strings, inclusive (weekends/holidays are excluded by the backend, not here). */
const spanDays = (a: string, b: string) =>
  a && b && b >= a ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1 : 0;

export default function LeaveApplyPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { types, availableFor } = useLeave();
  const [apply] = useApplyLeaveMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const uploadRef = useRef<FileUploadHandle>(null);

  const methods = useForm<LeaveApplicationValues>({
    resolver: zodResolver(leaveApplicationSchema),
    mode: 'onTouched',
    defaultValues: { leaveTypeId: '', startDate: today(), endDate: today(), dayPart: 'FULL_DAY', reason: '' },
  });
  const [typeId, startDate, endDate] = useWatch({
    control: methods.control,
    name: ['leaveTypeId', 'startDate', 'endDate'],
  });
  const selected = useMemo(() => types.find((t) => String(t.id) === typeId), [types, typeId]);
  const available = selected ? availableFor(selected.id) : null;
  const requested = spanDays(startDate, endDate);

  const submit = methods.handleSubmit(async (v) => {
    setServerError(null);
    try {
      const created = await apply({
        leaveTypeId: Number(v.leaveTypeId),
        startDate: v.startDate,
        endDate: v.endDate,
        dayPart: v.dayPart,
        reason: v.reason,
      }).unwrap();
      if (file)
        await leaveApi
          .uploadDocument(created.id, file)
          .catch((e) => notify.error(`Request saved, but the document failed: ${errorMessage(e)}`));
      notify.success('Leave request submitted');
      navigate(`/leaves/${created.id}`, { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <FormProvider {...methods}>
      <PageHeader title="Apply for leave" />
      <Paper component="form" onSubmit={submit} noValidate sx={{ p: 3, maxWidth: 680 }}>
        <Stack spacing={2}>
          {serverError && (
            <Alert severity="error" role="alert">
              {serverError}
            </Alert>
          )}
          <FormSelect<LeaveApplicationValues>
            name="leaveTypeId"
            label="Leave type"
            options={types.map((t) => ({ value: String(t.id), label: t.name }))}
            emptyLabel="Select…"
            required
          />
          {selected && (
            <Alert severity={available !== null && requested > available ? 'warning' : 'info'}>
              {available !== null ? `${available} day(s) available.` : 'Balance unavailable.'}{' '}
              {requested > 0 && `This request spans ${requested} calendar day(s).`}
              {selected.policy &&
                !selected.policy.allowHalfDay &&
                ' Half-days are not allowed for this type.'}
              {selected.requiresDocument && ' A supporting document is required.'}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormTextField<LeaveApplicationValues> name="startDate" label="Start date" type="date" required />
            <FormTextField<LeaveApplicationValues> name="endDate" label="End date" type="date" required />
          </Stack>
          <FormSelect<LeaveApplicationValues>
            name="dayPart"
            label="Day part"
            options={['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'].map((v) => ({ value: v, label: humanize(v) }))}
          />
          <FormTextField<LeaveApplicationValues> name="reason" label="Reason" multiline rows={3} required />
          <div>
            <Typography variant="subtitle2" gutterBottom>
              Supporting document (optional)
            </Typography>
            <FileUpload
              ref={uploadRef}
              accept="image/jpeg,image/png,application/pdf"
              maxBytes={2 * 1024 * 1024}
              label={file ? 'Change document' : 'Attach document'}
              onFile={(f) => setFile(f)}
            />
          </div>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={methods.formState.isSubmitting}>
              {methods.formState.isSubmitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </FormProvider>
  );
}
