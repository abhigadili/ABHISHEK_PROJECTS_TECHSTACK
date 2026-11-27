import { Box, Button, Card, CardContent, Stack, Switch, Typography } from '@mui/material';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/dialogs/Modal';
import { FormCheckbox, FormSelect, FormTextField } from '@/components/forms/fields';
import {
  useAdjustLeaveBalanceMutation,
  useCreateLeaveTypeMutation,
  useListLeaveTypesQuery,
  useUpdateLeaveTypeMutation,
} from '@/store/api/emsApi';
import { useModal } from '@/hooks/useModal';
import { useNotify } from '@/contexts/NotificationContext';
import {
  balanceAdjustSchema,
  leaveTypeSchema,
  type BalanceAdjustValues,
  type LeaveTypeValues,
} from '@/schemas/leaveAttendance';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { fetchEmployeeDirectory } from '@/store/slices/employeeSlice';
import { directorySelectors } from '@/store/selectors/employeeSelectors';
import { errorMessage } from '@/api/errors';
import type { LeaveType } from '@/types/api';
import { useEffect } from 'react';

/** HR leave administration: leave types/policies and manual balance adjustments (admins only). */
export default function LeaveAdminPage() {
  const { data = [], isLoading, isError, error, refetch } = useListLeaveTypesQuery();
  const [update] = useUpdateLeaveTypeMutation();
  const typeModal = useModal();
  const adjustModal = useModal();
  const notify = useNotify();

  const toggle = async (t: LeaveType) => {
    try {
      await update({ id: t.id, body: { isActive: !t.isActive } }).unwrap();
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };
  const columns: Column<LeaveType>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'entitlement',
      header: 'Per year',
      align: 'right',
      render: (t) => t.policy?.annualEntitlement ?? '—',
    },
    {
      key: 'carry',
      header: 'Carry fwd',
      align: 'right',
      hideBelow: 'sm',
      render: (t) => t.policy?.carryForwardMax ?? '—',
    },
    { key: 'paid', header: 'Paid', hideBelow: 'sm', render: (t) => (t.isPaid ? 'Yes' : 'No') },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'toggle',
      header: 'Active',
      render: (t) => (
        <Switch
          size="small"
          checked={t.isActive}
          onChange={() => toggle(t)}
          slotProps={{ input: { 'aria-label': `${t.name} active` } }}
        />
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Leave administration"
        actions={
          <>
            <Button variant="outlined" onClick={() => adjustModal.open()}>
              Adjust a balance
            </Button>
            <Button variant="contained" onClick={() => typeModal.open()}>
              New leave type
            </Button>
          </>
        }
      />
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Leave types define yearly entitlement and carry-forward. Balances are created per employee per
            year by the backend; use “Adjust a balance” for corrections (the note is audited).
          </Typography>
        </CardContent>
      </Card>
      <DataTable<LeaveType>
        caption="Leave types"
        columns={columns}
        rows={data}
        getRowId={(t) => t.id}
        loading={isLoading}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
      />
      <LeaveTypeDialog open={typeModal.isOpen} onClose={typeModal.close} />
      <AdjustDialog open={adjustModal.isOpen} onClose={adjustModal.close} types={data} />
    </>
  );
}

function LeaveTypeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [create] = useCreateLeaveTypeMutation();
  const notify = useNotify();
  const methods = useForm<LeaveTypeValues>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      code: '',
      name: '',
      annualEntitlement: '12',
      carryForwardMax: '0',
      isPaid: true,
      allowHalfDay: true,
    },
  });
  const submit = methods.handleSubmit(async (v) => {
    try {
      await create({
        code: v.code,
        name: v.name,
        isPaid: v.isPaid,
        policy: {
          annualEntitlement: Number(v.annualEntitlement),
          carryForwardMax: Number(v.carryForwardMax),
          allowHalfDay: v.allowHalfDay,
        },
      }).unwrap();
      notify.success('Leave type created');
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
      title="New leave type"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormTextField<LeaveTypeValues> name="code" label="Code" helperText="e.g. CL, SL — A-Z, 0-9, _" />
          <FormTextField<LeaveTypeValues> name="name" label="Name" />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <FormTextField<LeaveTypeValues> name="annualEntitlement" label="Days per year" type="number" />
            <FormTextField<LeaveTypeValues> name="carryForwardMax" label="Max carry-forward" type="number" />
          </Box>
          <FormCheckbox<LeaveTypeValues> name="isPaid" label="Paid leave" />
          <FormCheckbox<LeaveTypeValues> name="allowHalfDay" label="Allow half-days" />
        </Stack>
      </FormProvider>
    </Modal>
  );
}

function AdjustDialog({ open, onClose, types }: { open: boolean; onClose: () => void; types: LeaveType[] }) {
  const dispatch = useAppDispatch();
  const [adjust] = useAdjustLeaveBalanceMutation();
  const notify = useNotify();
  const employees = useAppSelector(directorySelectors.selectAll);
  useEffect(() => {
    if (open) void dispatch(fetchEmployeeDirectory());
  }, [open, dispatch]);
  const methods = useForm<BalanceAdjustValues>({
    resolver: zodResolver(balanceAdjustSchema),
    defaultValues: { employeeId: '', leaveTypeId: '', amount: '', note: '' },
  });
  const empOptions = useMemo(
    () => employees.map((e) => ({ value: String(e.id), label: `${e.name} (${e.code})` })),
    [employees],
  );
  const submit = methods.handleSubmit(async (v) => {
    try {
      await adjust({
        employeeId: Number(v.employeeId),
        leaveTypeId: Number(v.leaveTypeId),
        year: new Date().getFullYear(),
        amount: Number(v.amount),
        note: v.note,
      }).unwrap();
      notify.success('Balance adjusted');
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
      title="Adjust leave balance"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit}>
            Apply
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormSelect<BalanceAdjustValues>
            name="employeeId"
            label="Employee"
            options={empOptions}
            emptyLabel="Select…"
          />
          <FormSelect<BalanceAdjustValues>
            name="leaveTypeId"
            label="Leave type"
            options={types.map((t) => ({ value: String(t.id), label: t.name }))}
            emptyLabel="Select…"
          />
          <FormTextField<BalanceAdjustValues> name="amount" label="Days (+ add / − deduct)" type="number" />
          <FormTextField<BalanceAdjustValues> name="note" label="Note" multiline rows={2} />
        </Stack>
      </FormProvider>
    </Modal>
  );
}
