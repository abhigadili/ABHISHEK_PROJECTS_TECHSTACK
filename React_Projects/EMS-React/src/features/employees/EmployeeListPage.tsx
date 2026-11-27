import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { SearchBox } from '@/components/tables/SearchBox';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProfilePicture } from '@/components/common/ProfilePicture';
import { EmployeeCard } from '@/components/common/EmployeeCard';
import { Can } from '@/components/common/Can';
import { useEmployees } from '@/hooks/useEmployees';
import { useDepartmentFilter, useDepartments, useDesignations } from '@/hooks/useDepartments';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { setSelected, toggleSelected } from '@/store/slices/employeeSlice';
import { selectSelectedIds } from '@/store/selectors/employeeSelectors';
import { formatDate, humanize } from '@/utils/format';
import { errorMessage } from '@/api/errors';
import type { Employee } from '@/types/api';

const STATUS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'TERMINATED', label: 'Terminated' },
];
const TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((v) => ({ value: v, label: humanize(v) }));

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { filters, update, data, isFetching, isLoading, isError, error, refetch } = useEmployees();
  const { options: deptOptions } = useDepartments();
  const { options: desigOptions } = useDesignations();
  const [deptFilter, setDeptFilter] = useDepartmentFilter();
  const selectedIds = useAppSelector(selectSelectedIds);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [isPending, startTransition] = useTransition();

  // search box: local controlled state → debounced → URL (so typing is instant, requests are not)
  const [text, setText] = useState(filters.q);
  const debounced = useDebounce(text, 350);
  useEffect(() => {
    if (debounced !== filters.q) update({ q: debounced });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setText(filters.q);
  }, [filters.q]); // back/forward navigation updates the box

  // honour the cross-screen department filter when the URL doesn't specify one
  useEffect(() => {
    if (filters.departmentId === undefined && deptFilter != null) update({ departmentId: deptFilter });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // rows are deferred so typing/clicking never waits for a big table to re-render (concurrent rendering)
  const deferredItems = useDeferredValue(data?.items ?? []);
  const stale = deferredItems !== (data?.items ?? []);

  const onToggle = useCallback(
    (id: number) => {
      dispatch(toggleSelected(id));
    },
    [dispatch],
  );
  const onOpen = useCallback(
    (e: Employee) => navigate(`/employees/${e.id}`, { state: { fromList: true } }),
    [navigate],
  );
  const onCardOpen = useCallback((id: number) => navigate(`/employees/${id}`), [navigate]);

  const columns = useMemo<Column<Employee>[]>(
    () => [
      {
        key: 'name',
        header: 'Employee',
        sortKey: 'name',
        render: (e) => (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ProfilePicture
              employeeId={e.id}
              name={e.fullName}
              hasPicture={!!e.profilePictureUrl}
              size={32}
            />
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {e.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {e.workEmail}
              </Typography>
            </Box>
          </Stack>
        ),
      },
      { key: 'employeeCode', header: 'Code', sortKey: 'employeeCode', hideBelow: 'sm' },
      {
        key: 'department',
        header: 'Department',
        sortKey: 'department',
        hideBelow: 'md',
        render: (e) => e.department?.name ?? '—',
      },
      { key: 'jobTitle', header: 'Title', hideBelow: 'md', render: (e) => e.jobTitle ?? '—' },
      {
        key: 'joiningDate',
        header: 'Joined',
        sortKey: 'joiningDate',
        hideBelow: 'sm',
        render: (e) => formatDate(e.joiningDate),
      },
      {
        key: 'status',
        header: 'Status',
        sortKey: 'status',
        render: (e) => <StatusBadge status={e.status} />,
      },
    ],
    [],
  );

  const [sortField, sortDir] = filters.sort.split(':');
  const onSort = (field: string) =>
    startTransition(() =>
      update({ sort: sortField === field && sortDir !== 'desc' ? `${field}:desc` : field }),
    );

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={data ? `${data.meta.total} employees` : undefined}
        actions={
          <Can permission="employee:manage">
            <Button component={RouterLink} to="/employees/new" variant="contained" startIcon={<AddIcon />}>
              New employee
            </Button>
          </Can>
        }
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
        <Box sx={{ flexGrow: 1, maxWidth: { md: 360 } }}>
          <SearchBox value={text} onChange={setText} placeholder="Name, email, code or title" />
        </Box>
        <FilterSelect
          label="Department"
          value={filters.departmentId ? String(filters.departmentId) : ''}
          options={deptOptions}
          onChange={(v) => {
            setDeptFilter(v ? Number(v) : null);
            startTransition(() => update({ departmentId: v }));
          }}
        />
        <FilterSelect
          label="Designation"
          value={filters.designationId ? String(filters.designationId) : ''}
          options={desigOptions}
          onChange={(v) => startTransition(() => update({ designationId: v }))}
        />
        <FilterSelect
          label="Status"
          value={filters.status === 'ALL' ? '' : filters.status}
          options={STATUS}
          allLabel="All statuses"
          onChange={(v) => startTransition(() => update({ status: v || 'ALL' }))}
          minWidth={150}
        />
        <FilterSelect
          label="Type"
          value={filters.employmentType}
          options={TYPES}
          onChange={(v) => startTransition(() => update({ employmentType: v }))}
          minWidth={140}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
          aria-label="View mode"
        >
          <ToggleButton value="table" aria-label="Table view">
            <ViewListIcon />
          </ToggleButton>
          <ToggleButton value="cards" aria-label="Card view">
            <ViewModuleIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {selectedIds.length > 0 && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="body2">{selectedIds.length} selected</Typography>
          <Button size="small" onClick={() => dispatch(setSelected([]))}>
            Clear
          </Button>
        </Stack>
      )}
      {view === 'table' ? (
        <DataTable<Employee>
          caption="Employees"
          columns={columns}
          rows={deferredItems}
          getRowId={(e) => e.id}
          loading={isLoading || isFetching || isPending || stale}
          error={isError ? errorMessage(error) : null}
          onRetry={refetch}
          onRowClick={onOpen}
          selectedIds={selectedIds}
          onToggleRow={onToggle}
          sort={{ field: sortField, dir: sortDir === 'desc' ? 'desc' : 'asc' }}
          onSort={onSort}
          emptyTitle="No employees match"
          emptyDescription="Try clearing a filter or searching for something else."
          pagination={
            data
              ? {
                  page: data.meta.page,
                  limit: data.meta.limit,
                  total: data.meta.total,
                  onPage: (p) => update({ page: p }),
                  onLimit: (l) => update({ limit: l, page: 1 }),
                }
              : undefined
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' },
          }}
        >
          {deferredItems.map((e) => (
            <EmployeeCard key={e.id} employee={e} onSelect={onCardOpen} />
          ))}
        </Box>
      )}
    </>
  );
}
