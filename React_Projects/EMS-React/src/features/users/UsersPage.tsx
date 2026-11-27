import { Alert, Box, Button, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { SearchBox } from '@/components/tables/SearchBox';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/dialogs/Modal';
import { FormSelect, FormTextField } from '@/components/forms/fields';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import {
  useCreateAccountMutation,
  useDeactivateEmployeeMutation,
  useListEmployeesQuery,
  useReactivateEmployeeMutation,
  useSetRoleMutation,
} from '@/store/api/emsApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useModal } from '@/hooks/useModal';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useNotify } from '@/contexts/NotificationContext';
import { userCreateSchema, type UserCreateValues } from '@/schemas/auth';
import { ROLES, ROLE_LABEL, type Role } from '@/constants/roles';
import { errorMessage, fieldErrors } from '@/api/errors';
import type { Employee } from '@/types/api';

/**
 * User & role management. The backend models users 1:1 with employees (no /users endpoint), so this screen composes the
 * employee APIs: list (account.role), POST /employees/:id/account, PUT /employees/:id/role (SUPER_ADMIN only) and activate/deactivate.
 */
export default function UsersPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();
  const { can } = usePermissions();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [login, setLogin] = useState('');
  const q = useDebounce(text, 300);
  const pg = usePagination();
  useEffect(() => {
    pg.reset();
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isLoading, isFetching, isError, error, refetch } = useListEmployeesQuery({
    q: q || undefined,
    status: 'ALL',
    page: pg.page,
    limit: pg.limit,
  });
  const [setRole] = useSetRoleMutation();
  const [deactivate] = useDeactivateEmployeeMutation();
  const [reactivate] = useReactivateEmployeeMutation();
  const createModal = useModal<Employee>();

  const rows = useMemo(
    () =>
      (data?.items ?? []).filter((e) => (login === 'yes' ? e.account : login === 'no' ? !e.account : true)),
    [data, login],
  );

  const changeRole = async (e: Employee, role: Role) => {
    if (
      !(await confirm({
        title: 'Change role?',
        message: `${e.fullName} will become ${ROLE_LABEL[role]}.`,
        confirmLabel: 'Change role',
      }))
    )
      return;
    try {
      await setRole({ id: e.id, role }).unwrap();
      notify.success('Role updated');
    } catch (err) {
      notify.error(errorMessage(err));
    }
  };
  const toggleActive = async (e: Employee) => {
    const off = e.status === 'ACTIVE';
    if (
      !(await confirm({
        title: off ? 'Deactivate user?' : 'Reactivate user?',
        message: e.fullName,
        destructive: off,
        confirmLabel: off ? 'Deactivate' : 'Reactivate',
      }))
    )
      return;
    try {
      if (off) await deactivate({ id: e.id, reason: 'Deactivated from Users & roles' }).unwrap();
      else await reactivate(e.id).unwrap();
      notify.success(off ? 'User deactivated' : 'User reactivated');
    } catch (err) {
      notify.error(errorMessage(err));
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'User',
      render: (e) => (
        <Box>
          <Typography fontWeight={600}>{e.fullName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {e.workEmail}
          </Typography>
        </Box>
      ),
    },
    { key: 'department', header: 'Department', hideBelow: 'md', render: (e) => e.department?.name ?? '—' },
    {
      key: 'role',
      header: 'Role',
      render: (e) =>
        !e.account ? (
          <StatusBadge status="INACTIVE" label="No login" />
        ) : can('users:set-role') && e.account.userId !== user?.id ? (
          <Select
            size="small"
            value={e.account.role}
            onChange={(ev) => changeRole(e, ev.target.value as Role)}
            onClick={(ev) => ev.stopPropagation()}
            inputProps={{ 'aria-label': `Role for ${e.fullName}` }}
          >
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <StatusBadge status={e.account.role} label={ROLE_LABEL[e.account.role]} />
        ),
    },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'actions',
      header: '',
      render: (e) => (
        <Stack direction="row" spacing={0.5} onClick={(ev) => ev.stopPropagation()}>
          {!e.account && e.status === 'ACTIVE' && (
            <Button size="small" onClick={() => createModal.open(e)}>
              Create login
            </Button>
          )}
          {e.account?.userId !== user?.id && (
            <Button
              size="small"
              color={e.status === 'ACTIVE' ? 'error' : 'success'}
              onClick={() => toggleActive(e)}
            >
              {e.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Users & roles" subtitle="Who can sign in, and with which role" />
      {!can('users:set-role') && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only a Super Admin can change roles. You can create logins and (de)activate users.
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <SearchBox value={text} onChange={setText} placeholder="Name, email or code" />
        <FilterSelect
          label="Login"
          value={login}
          options={[
            { value: 'yes', label: 'Has login' },
            { value: 'no', label: 'No login' },
          ]}
          onChange={setLogin}
        />
      </Stack>
      <DataTable<Employee>
        caption="Users"
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        loading={isLoading || isFetching}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        onRowClick={(e) => navigate(`/employees/${e.id}`)}
        emptyTitle="No users match"
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
      <CreateLoginDialog
        employee={createModal.data ?? null}
        open={createModal.isOpen}
        onClose={createModal.close}
      />
    </>
  );
}

function CreateLoginDialog({
  employee,
  open,
  onClose,
}: {
  employee: Employee | null;
  open: boolean;
  onClose: () => void;
}) {
  const [create] = useCreateAccountMutation();
  const notify = useNotify();
  const { can } = usePermissions();
  const methods = useForm<UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { role: 'EMPLOYEE', password: '', confirmPassword: '' },
  });
  const { reset } = methods;
  useEffect(() => {
    if (open) reset({ role: 'EMPLOYEE', password: '', confirmPassword: '' });
  }, [open, reset]);
  const roles = can('users:set-role') ? ROLES : (['EMPLOYEE', 'MANAGER'] as Role[]);
  const submit = methods.handleSubmit(async (v) => {
    if (!employee) return;
    try {
      await create({ id: employee.id, role: v.role, password: v.password }).unwrap();
      notify.success(`Login created for ${employee.fullName}`);
      onClose();
    } catch (e) {
      const errs = fieldErrors(e);
      const known = Object.entries(errs).filter(([f]) => f in methods.getValues());
      if (known.length)
        known.forEach(([f, m]) =>
          methods.setError(f as keyof UserCreateValues, { type: 'server', message: m }),
        );
      else notify.error(errorMessage(e));
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Create login${employee ? ` for ${employee.fullName}` : ''}`}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit}>
            Create login
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormSelect<UserCreateValues>
            name="role"
            label="Role"
            options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
          <FormTextField<UserCreateValues>
            name="password"
            label="Initial password"
            type="password"
            helperText="10+ chars with upper, lower, digit and symbol"
          />
          <FormTextField<UserCreateValues> name="confirmPassword" label="Confirm password" type="password" />
        </Stack>
      </FormProvider>
    </Modal>
  );
}
