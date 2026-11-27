import { Button, Stack, Switch } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { SearchBox } from '@/components/tables/SearchBox';
import { Modal } from '@/components/dialogs/Modal';
import { FormTextField } from '@/components/forms/fields';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Can } from '@/components/common/Can';
import {
  useCreateDesignationMutation,
  useListDesignationsQuery,
  useUpdateDesignationMutation,
} from '@/store/api/emsApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useModal } from '@/hooks/useModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { designationSchema, type DesignationFormValues } from '@/schemas/organization';
import { errorMessage, fieldErrors } from '@/api/errors';
import type { Designation } from '@/types/api';

export default function DesignationsPage() {
  const [text, setText] = useState('');
  const q = useDebounce(text, 300);
  const { data, isLoading, isFetching, isError, error, refetch } = useListDesignationsQuery({
    q: q || undefined,
    limit: 100,
  });
  const [update] = useUpdateDesignationMutation();
  const modal = useModal<Designation | null>();
  const { isAdmin } = usePermissions();
  const notify = useNotify();

  const toggle = async (d: Designation) => {
    try {
      await update({ id: d.id, body: { isActive: !d.isActive } }).unwrap();
      notify.success(d.isActive ? 'Designation deactivated' : 'Designation activated');
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };

  const columns: Column<Designation>[] = [
    { key: 'name', header: 'Designation', sortKey: undefined },
    { key: 'jobLevel', header: 'Job level / grade', align: 'right', render: (d) => `L${d.jobLevel}` },
    { key: 'description', header: 'Description', hideBelow: 'md', render: (d) => d.description ?? '—' },
    { key: 'headcount', header: 'Employees', align: 'right' },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            render: (d: Designation) => (
              <Stack direction="row" alignItems="center">
                <Button size="small" onClick={() => modal.open(d)}>
                  Edit
                </Button>
                <Switch
                  size="small"
                  checked={d.isActive}
                  onChange={() => toggle(d)}
                  slotProps={{ input: { 'aria-label': `${d.name} active` } }}
                />
              </Stack>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Designations"
        subtitle="Job titles and levels. Assign a designation to an employee from the employee form."
        actions={
          <Can permission="designation:manage">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => modal.open(null)}>
              New designation
            </Button>
          </Can>
        }
      />
      <Stack sx={{ mb: 2, maxWidth: 360 }}>
        <SearchBox value={text} onChange={setText} placeholder="Search designations" />
      </Stack>
      <DataTable<Designation>
        caption="Designations"
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(d) => d.id}
        loading={isLoading || isFetching}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        emptyTitle="No designations"
      />
      <DesignationDialog open={modal.isOpen} designation={modal.data ?? null} onClose={modal.close} />
    </>
  );
}

function DesignationDialog({
  open,
  designation,
  onClose,
}: {
  open: boolean;
  designation: Designation | null;
  onClose: () => void;
}) {
  const [create] = useCreateDesignationMutation();
  const [update] = useUpdateDesignationMutation();
  const notify = useNotify();
  const methods = useForm<DesignationFormValues>({
    resolver: zodResolver(designationSchema),
    defaultValues: { name: '', description: '', jobLevel: '3' },
  });
  const { reset } = methods;
  // sync the form with the row being edited each time the dialog opens
  useEffect(() => {
    if (open)
      reset(
        designation
          ? {
              name: designation.name,
              description: designation.description ?? '',
              jobLevel: String(designation.jobLevel),
            }
          : { name: '', description: '', jobLevel: '3' },
      );
  }, [open, designation, reset]);

  const submit = methods.handleSubmit(async (v) => {
    const body = { name: v.name, description: v.description || undefined, jobLevel: Number(v.jobLevel) };
    try {
      if (designation) await update({ id: designation.id, body }).unwrap();
      else await create(body).unwrap();
      notify.success(designation ? 'Designation updated' : 'Designation created');
      onClose();
    } catch (e) {
      const errs = fieldErrors(e);
      const known = Object.entries(errs).filter(([f]) => f in methods.getValues());
      if (known.length)
        known.forEach(([f, m]) =>
          methods.setError(f as keyof DesignationFormValues, { type: 'server', message: m }),
        );
      else notify.error(errorMessage(e));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={designation ? 'Edit designation' : 'New designation'}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={methods.formState.isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormTextField<DesignationFormValues> name="name" label="Name" required />
          <FormTextField<DesignationFormValues> name="jobLevel" label="Job level (1–20)" type="number" />
          <FormTextField<DesignationFormValues> name="description" label="Description" multiline rows={2} />
        </Stack>
      </FormProvider>
    </Modal>
  );
}
