import { Button, Stack, Switch, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useFetcher, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { SearchBox } from '@/components/tables/SearchBox';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Can } from '@/components/common/Can';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { useListDepartmentsQuery } from '@/store/api/emsApi';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage } from '@/api/errors';
import type { Department } from '@/types/api';

/** Status switch that submits to the route ACTION `/departments/:id/status` through a fetcher (no navigation, no page reload). */
function StatusSwitch({ dept }: { dept: Department }) {
  const fetcher = useFetcher<{ ok: boolean; message?: string; active?: boolean }>();
  const confirm = useConfirm();
  const notify = useNotify();
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.ok)
        notify.success(fetcher.data.active ? 'Department activated' : 'Department deactivated');
      else notify.error(fetcher.data.message ?? 'Failed');
    }
  }, [fetcher.state, fetcher.data, notify]);

  const toggle = async () => {
    const next = !dept.isActive;
    if (
      !next &&
      !(await confirm({
        title: `Deactivate ${dept.name}?`,
        message: 'Employees must be reassigned first or the server will refuse.',
        confirmLabel: 'Deactivate',
        destructive: true,
      }))
    )
      return;
    fetcher.submit({ active: String(next) }, { method: 'post', action: `/departments/${dept.id}/status` });
  };
  return (
    <Switch
      checked={dept.isActive}
      onChange={toggle}
      disabled={busy}
      slotProps={{ input: { 'aria-label': `${dept.name} active` } }}
    />
  );
}

export default function DepartmentListPage() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [text, setText] = useState('');
  const [active, setActive] = useState('');
  const q = useDebounce(text, 300);
  const pg = usePagination();
  useEffect(() => {
    pg.reset();
  }, [q, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isLoading, isFetching, isError, error, refetch } = useListDepartmentsQuery({
    q: q || undefined,
    isActive: active === '' ? undefined : active === 'true',
    page: pg.page,
    limit: pg.limit,
  });

  const columns: Column<Department>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name', render: (d) => <Typography fontWeight={600}>{d.name}</Typography> },
    { key: 'head', header: 'Head', hideBelow: 'sm', render: (d) => d.headName ?? '—' },
    { key: 'headcount', header: 'Active staff', align: 'right' },
    {
      key: 'isActive',
      header: 'Status',
      render: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    ...(isAdmin
      ? [
          {
            key: 'toggle',
            header: 'Active',
            render: (d: Department) => (
              // the row is clickable (opens details): interacting with the switch must not also navigate
              <span onClick={(e) => e.stopPropagation()}>
                <StatusSwitch dept={d} />
              </span>
            ),
          },
          {
            key: 'edit',
            header: '',
            render: (d: Department) => (
              <Button
                size="small"
                component={RouterLink}
                to={`/departments/${d.id}/edit`}
                onClick={(e) => e.stopPropagation()}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle={data ? `${data.meta.total} departments` : undefined}
        actions={
          <Can permission="department:manage">
            <Button component={RouterLink} to="/departments/new" variant="contained" startIcon={<AddIcon />}>
              New department
            </Button>
          </Can>
        }
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <SearchBox value={text} onChange={setText} placeholder="Code or name" />
        <FilterSelect
          label="Status"
          value={active}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          onChange={setActive}
          allLabel="All"
        />
      </Stack>
      <DataTable<Department>
        caption="Departments"
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(d) => d.id}
        loading={isLoading || isFetching}
        error={isError ? errorMessage(error) : null}
        onRetry={refetch}
        onRowClick={(d) => navigate(`/departments/${d.id}`)}
        emptyTitle="No departments found"
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
    </>
  );
}
