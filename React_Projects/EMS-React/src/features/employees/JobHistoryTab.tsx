import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEmployeeContext } from './useEmployeeContext';
import { useGetJobHistoryQuery, useUpdateEmployeeMutation } from '@/store/api/emsApi';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/dialogs/Modal';
import { FormSelect, FormTextField } from '@/components/forms/fields';
import { ManagerSelect } from '@/components/forms/ManagerSelect';
import { Can } from '@/components/common/Can';
import { useModal } from '@/hooks/useModal';
import { useDepartments, useDesignations } from '@/hooks/useDepartments';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage } from '@/api/errors';
import { formatDate, humanize, today, toId } from '@/utils/format';
import { z } from 'zod';
import { optionalText, requiredDate } from '@/schemas/common';
import type { ChangeType, JobHistoryEntry } from '@/types/api';

const changeSchema = z
  .object({
    changeType: z.enum(['PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'JOB_CHANGE']),
    effectiveDate: requiredDate('Effective date'),
    designationId: z.string(),
    departmentId: z.string(),
    managerId: z.string(),
    jobTitle: optionalText(120),
    notes: optionalText(500),
  })
  .refine((v) => v.designationId || v.departmentId || v.managerId || v.jobTitle, {
    path: ['jobTitle'],
    message: 'Choose at least one thing that changes',
  });
type ChangeValues = z.infer<typeof changeSchema>;

const arrow = (from: string | null, to: string | null) =>
  from === to ? (to ?? '—') : `${from ?? '—'} → ${to ?? '—'}`;

export default function JobHistoryTab() {
  const { employee } = useEmployeeContext();
  const { data = [], isLoading, isError, error, refetch } = useGetJobHistoryQuery(employee.id);
  const modal = useModal();

  const columns: Column<JobHistoryEntry>[] = [
    { key: 'effectiveDate', header: 'Effective', render: (h) => formatDate(h.effectiveDate) },
    {
      key: 'changeType',
      header: 'Change',
      render: (h) => (
        <StatusBadge
          status={h.changeType === 'JOINED' ? 'ACTIVE' : 'PENDING'}
          label={humanize(h.changeType)}
        />
      ),
    },
    { key: 'title', header: 'Title', render: (h) => arrow(h.fromJobTitle, h.toJobTitle) },
    {
      key: 'designation',
      header: 'Designation',
      hideBelow: 'sm',
      render: (h) => arrow(h.fromDesignation, h.toDesignation),
    },
    {
      key: 'department',
      header: 'Department',
      hideBelow: 'md',
      render: (h) => arrow(h.fromDepartment, h.toDepartment),
    },
    { key: 'manager', header: 'Manager', hideBelow: 'md', render: (h) => arrow(h.fromManager, h.toManager) },
    { key: 'notes', header: 'Notes', hideBelow: 'md', render: (h) => h.notes ?? '—' },
  ];

  return (
    <Stack spacing={2}>
      <Can permission="employee:manage">
        <Box>
          <Button variant="contained" startIcon={<SwapVertIcon />} onClick={() => modal.open()}>
            Record promotion / transfer
          </Button>
        </Box>
      </Can>
      <DataTable<JobHistoryEntry>
        caption="Job history"
        columns={columns}
        rows={data}
        getRowId={(h) => h.id}
        loading={isLoading}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        emptyTitle="No job history yet"
      />
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Promotions and transfers are recorded by the backend whenever an employee's job fields change with
            a change type and effective date.
          </Typography>
        </CardContent>
      </Card>
      <ChangeDialog open={modal.isOpen} onClose={modal.close} />
    </Stack>
  );
}

function ChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { employee } = useEmployeeContext();
  const notify = useNotify();
  const { options: deptOptions } = useDepartments({ activeOnly: true });
  const { options: desigOptions } = useDesignations();
  const [update, { isLoading }] = useUpdateEmployeeMutation();
  const methods = useForm<ChangeValues>({
    resolver: zodResolver(changeSchema),
    defaultValues: {
      changeType: 'PROMOTION',
      effectiveDate: today(),
      designationId: '',
      departmentId: '',
      managerId: '',
      jobTitle: '',
      notes: '',
    },
  });

  const submit = methods.handleSubmit(async (v) => {
    try {
      await update({
        id: employee.id,
        body: {
          changeType: v.changeType as ChangeType,
          effectiveDate: v.effectiveDate,
          notes: v.notes || undefined,
          designationId: toId(v.designationId),
          departmentId: toId(v.departmentId),
          managerId: toId(v.managerId),
          jobTitle: v.jobTitle || undefined,
        },
      }).unwrap();
      notify.success('Job change recorded');
      methods.reset();
      onClose();
    } catch (e) {
      notify.error(errorMessage(e));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record promotion / transfer"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={isLoading}>
            Save
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormSelect<ChangeValues>
            name="changeType"
            label="Change type"
            options={['PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'JOB_CHANGE'].map((v) => ({
              value: v,
              label: humanize(v),
            }))}
          />
          <FormTextField<ChangeValues> name="effectiveDate" label="Effective date" type="date" />
          <FormSelect<ChangeValues>
            name="designationId"
            label="New designation"
            options={desigOptions}
            emptyLabel="No change"
          />
          <FormSelect<ChangeValues>
            name="departmentId"
            label="New department"
            options={deptOptions}
            emptyLabel="No change"
          />
          <ManagerSelect<ChangeValues> name="managerId" label="New manager" excludeId={employee.id} />
          <FormTextField<ChangeValues> name="jobTitle" label="New job title" />
          <FormTextField<ChangeValues> name="notes" label="Notes" multiline rows={2} />
        </Stack>
      </FormProvider>
    </Modal>
  );
}
