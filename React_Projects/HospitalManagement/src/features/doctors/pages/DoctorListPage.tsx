import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, FormControl, FormControlLabel, Grid2 as Grid, InputLabel, MenuItem, Pagination, Paper, Select, Skeleton, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAdd';
import CompareArrows from '@mui/icons-material/CompareArrows';
import { useAppDispatch, useAppSelector } from '@/store/redux/hooks';
import { doctorFiltersActions, selectCompareCount, selectCompareIds, selectDoctorFilters, selectDoctorServerParams, selectHasActiveFilters, type DoctorSortKey } from '@/store/slices/doctorFiltersSlice';
import { useDoctorList, usePrefetchDoctor, useSpecializations } from '../hooks/useDoctors';
import { useDepartmentDirectory } from '@/features/hospitals/hooks/useHospitals';
import { DoctorCard } from '../components/DoctorCard';
import { DoctorCompareDialog } from '../components/DoctorCompareDialog';
import { SearchInput } from '@/components/common/SearchInput';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ProfiledSection } from '@/components/common/ProfiledSection';
import { useCan } from '@/contexts/AuthContext';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { Doctor } from '@/types';

const SORTS: { key: DoctorSortKey; label: string }[] = [
  { key: 'fullName', label: 'Name' },
  { key: 'specialization', label: 'Specialty' },
  { key: 'experienceYears', label: 'Experience' },
  { key: 'consultationFee', label: 'Fee' },
];

/**
 * Doctor directory (MUI + Redux Toolkit + React Redux).
 * Redux holds the UI state (search, filters, sort, page, compare tray) read through memoised selectors; the doctors
 * themselves are server state in TanStack Query. Search/filter/sort are derived with useMemo; pagination is
 * client-side because the whole (small) directory is fetched once per filter combination.
 */
export default function DoctorListPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const canManage = useCan('doctors:manage');
  const f = useAppSelector(selectDoctorFilters);
  const params = useAppSelector(selectDoctorServerParams);
  const compareIds = useAppSelector(selectCompareIds);
  const compareCount = useAppSelector(selectCompareCount);
  const hasFilters = useAppSelector(selectHasActiveFilters);
  const compareDialog = useDisclosure();
  const prefetch = usePrefetchDoctor();

  const doctors = useDoctorList(params);
  const specs = useSpecializations();
  const { directory, hospitals } = useDepartmentDirectory();

  const visible = useMemo(() => {
    const q = f.search.toLowerCase();
    const filtered = (doctors.data?.content ?? []).filter((d) => !q || [d.fullName, d.specialization, d.email, d.licenseNumber].some((x) => x.toLowerCase().includes(q)));
    const dir = f.sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[f.sortKey] ?? -1;
      const bv = b[f.sortKey] ?? -1;
      return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * dir;
    });
  }, [doctors.data, f.search, f.sortKey, f.sortDir]);

  const pageCount = Math.max(1, Math.ceil(visible.length / f.pageSize));
  const pageItems = useMemo(() => visible.slice(f.page * f.pageSize, (f.page + 1) * f.pageSize), [visible, f.page, f.pageSize]);

  const open = useCallback((id: number) => navigate(`/doctors/${id}`), [navigate]);
  const toggleCompare = useCallback((id: number) => dispatch(doctorFiltersActions.compareToggled(id)), [dispatch]);
  const onSearch = useCallback((q: string) => dispatch(doctorFiltersActions.searchChanged(q)), [dispatch]);

  const compared = useMemo(() => (doctors.data?.content ?? []).filter((d: Doctor) => compareIds.includes(d.id)), [doctors.data, compareIds]);
  const deptOptions = useMemo(() => [...directory.values()].map((v) => ({ id: v.department.id, name: v.department.name, hospital: v.hospital.name })), [directory]);

  return (
    <>
      <PageHeader title="Doctors" subtitle="Find a specialist, check schedules and availability" actions={canManage && <Button variant="contained" startIcon={<PersonAdd />} onClick={() => navigate('/doctors/new')}>Add doctor</Button>} />
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
          <SearchInput value={f.search} onSearch={onSearch} placeholder="Search name, specialty, e-mail…" />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="spec">Specialization</InputLabel>
            <Select labelId="spec" label="Specialization" value={f.specialization} onChange={(e) => dispatch(doctorFiltersActions.specializationChanged(e.target.value))}>
              <MenuItem value="">All specializations</MenuItem>
              {specs.data?.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="dept">Department</InputLabel>
            <Select labelId="dept" label="Department" value={f.departmentId ?? ''} onChange={(e) => dispatch(doctorFiltersActions.departmentChanged(e.target.value === '' ? null : Number(e.target.value)))}>
              <MenuItem value="">All departments</MenuItem>
              {deptOptions.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}{hospitals.length > 1 ? ` · ${d.hospital}` : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel control={<Switch checked={f.onlyActive} onChange={(e) => dispatch(doctorFiltersActions.onlyActiveChanged(e.target.checked))} />} label="Active only" />
          {hasFilters && <Button size="small" onClick={() => dispatch(doctorFiltersActions.filtersReset())}>Reset filters</Button>}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">Sort by</Typography>
          <ToggleButtonGroup size="small" exclusive value={f.sortKey} onChange={(_e, v: DoctorSortKey | null) => v && dispatch(doctorFiltersActions.sortChanged(v))} aria-label="Sort doctors">
            {SORTS.map((s) => <ToggleButton key={s.key} value={s.key} onClick={() => f.sortKey === s.key && dispatch(doctorFiltersActions.sortChanged(s.key))}>{s.label}{f.sortKey === s.key ? (f.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</ToggleButton>)}
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          <Chip color={compareCount ? 'primary' : 'default'} icon={<CompareArrows />} label={`Compare (${compareCount}/3)`} onClick={compareCount >= 2 ? compareDialog.open : undefined} disabled={compareCount < 2} />
          {compareCount > 0 && <Button size="small" onClick={() => dispatch(doctorFiltersActions.compareCleared())}>Clear</Button>}
        </Stack>
      </Paper>

      {doctors.isError && !doctors.data ? <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} /> : (
        <ProfiledSection id="DoctorDirectory">
          <Grid container spacing={2}>
            {doctors.isPending && Array.from({ length: 6 }, (_, i) => <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}><Skeleton variant="rounded" height={150} /></Grid>)}
            {pageItems.map((d) => (
              <Grid key={d.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <DoctorCard doctor={d} departmentName={d.departmentId ? directory.get(d.departmentId)?.department.name : undefined} compared={compareIds.includes(d.id)} onOpen={open} onHover={prefetch} onToggleCompare={toggleCompare} />
              </Grid>
            ))}
          </Grid>
        </ProfiledSection>
      )}
      {doctors.data && visible.length === 0 && <EmptyState title="No doctors match" description="Adjust the filters or search term." action={<Button onClick={() => dispatch(doctorFiltersActions.filtersReset())}>Reset filters</Button>} />}
      {visible.length > 0 && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">{visible.length} doctor{visible.length === 1 ? '' : 's'}</Typography>
          <Pagination count={pageCount} page={Math.min(f.page, pageCount - 1) + 1} onChange={(_e, p) => dispatch(doctorFiltersActions.pageChanged(p - 1))} color="primary" />
          <Select size="small" value={f.pageSize} onChange={(e) => dispatch(doctorFiltersActions.pageSizeChanged(Number(e.target.value)))} inputProps={{ 'aria-label': 'Doctors per page' }}>{[8, 16, 32].map((n) => <MenuItem key={n} value={n}>{n} / page</MenuItem>)}</Select>
        </Stack>
      )}
      {doctors.isError && doctors.data && <Alert severity="warning" sx={{ mt: 2 }}>Could not refresh doctors - showing cached data.</Alert>}
      <DoctorCompareDialog open={compareDialog.isOpen} onClose={compareDialog.close} doctors={compared} directory={directory} />
    </>
  );
}
