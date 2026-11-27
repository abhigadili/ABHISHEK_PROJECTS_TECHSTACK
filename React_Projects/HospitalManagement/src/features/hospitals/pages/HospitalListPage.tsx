import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, FormControlLabel, Grid2 as Grid, MenuItem, Paper, Select, Skeleton, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import AddBusiness from '@mui/icons-material/AddBusiness';
import ViewModule from '@mui/icons-material/ViewModule';
import ViewList from '@mui/icons-material/ViewList';
import { useHospitals } from '../hooks/useHospitals';
import { HospitalCard } from '../components/HospitalCard';
import { useHospitalStore } from '@/store/zustand/hospitalStore';
import { useActiveHospital } from '@/contexts/HospitalContext';
import { SearchInput } from '@/components/common/SearchInput';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { useCan } from '@/contexts/AuthContext';

/**
 * Hospital directory (MUI). UI preferences/filters/compare tray live in a Zustand store (selected with narrow selectors so
 * a component re-renders only for the slice it reads); the "active hospital" the user works in is a React Context.
 */
export default function HospitalListPage() {
  const navigate = useNavigate();
  const canManage = useCan('hospitals:manage');
  const { activeHospitalId, setActiveHospitalId } = useActiveHospital();
  const query = useHospitals();
  // Zustand: one selector per value => minimal re-rendering
  const view = useHospitalStore((s) => s.view);
  const setView = useHospitalStore((s) => s.setView);
  const search = useHospitalStore((s) => s.search);
  const setSearch = useHospitalStore((s) => s.setSearch);
  const city = useHospitalStore((s) => s.city);
  const setCity = useHospitalStore((s) => s.setCity);
  const showInactive = useHospitalStore((s) => s.showInactive);
  const setShowInactive = useHospitalStore((s) => s.setShowInactive);
  const compareIds = useHospitalStore((s) => s.compareIds);
  const toggleCompare = useHospitalStore((s) => s.toggleCompare);
  const clearCompare = useHospitalStore((s) => s.clearCompare);

  const cities = useMemo(() => [...new Set((query.data ?? []).map((h) => h.city).filter(Boolean) as string[])].sort(), [query.data]);
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return (query.data ?? []).filter((h) => (showInactive || h.active) && (!city || h.city === city) && (!q || [h.name, h.code, h.city ?? '', h.address ?? ''].some((x) => x.toLowerCase().includes(q))));
  }, [query.data, search, city, showInactive]);
  const compared = useMemo(() => (query.data ?? []).filter((h) => compareIds.includes(h.id)), [query.data, compareIds]);

  const open = useCallback((id: number) => navigate(`/hospitals/${id}`), [navigate]);

  return (
    <>
      <PageHeader title="Hospitals" subtitle="Hospitals, their departments and facilities" actions={canManage && <Button variant="contained" startIcon={<AddBusiness />} onClick={() => navigate('/hospitals/new')}>Add hospital</Button>} />
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
          <SearchInput value={search} onSearch={setSearch} placeholder="Search hospitals…" />
          <Select size="small" displayEmpty value={city} onChange={(e) => setCity(e.target.value)} inputProps={{ 'aria-label': 'City' }} sx={{ minWidth: 160 }}>
            <MenuItem value="">All cities</MenuItem>
            {cities.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
          {canManage && <FormControlLabel control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label="Show inactive" />}
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v: 'grid' | 'table' | null) => v && setView(v)} aria-label="View mode">
            <ToggleButton value="grid" aria-label="Grid view"><ViewModule fontSize="small" /></ToggleButton>
            <ToggleButton value="table" aria-label="Table view"><ViewList fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {compared.length >= 2 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography fontWeight={700}>Comparison</Typography><Button size="small" onClick={clearCompare}>Clear</Button></Stack>
          <Table size="small"><TableHead><TableRow><TableCell />{compared.map((h) => <TableCell key={h.id} sx={{ fontWeight: 700 }}>{h.name}</TableCell>)}</TableRow></TableHead>
            <TableBody>{([['Code', (h) => h.code], ['City', (h) => h.city ?? '—'], ['Phone', (h) => h.phone ?? '—'], ['E-mail', (h) => h.email ?? '—']] as Array<[string, (h: (typeof compared)[number]) => string]>).map(([l, g]) => <TableRow key={l}><TableCell sx={{ color: 'text.secondary' }}>{l}</TableCell>{compared.map((h) => <TableCell key={h.id}>{g(h)}</TableCell>)}</TableRow>)}</TableBody></Table>
        </Paper>
      )}

      {query.isPending && <Grid container spacing={2}>{[0, 1, 2].map((i) => <Grid key={i} size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" height={170} /></Grid>)}</Grid>}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && visible.length === 0 && <EmptyState title="No hospitals found" description="Change the search or filters." />}
      {query.data && visible.length > 0 && (view === 'grid' ? (
        <Grid container spacing={2}>
          {visible.map((h) => <Grid key={h.id} size={{ xs: 12, sm: 6, lg: 4 }}><HospitalCard hospital={h} active={activeHospitalId === h.id} compared={compareIds.includes(h.id)} onOpen={open} onToggleCompare={toggleCompare} onMakeActive={setActiveHospitalId} /></Grid>)}
        </Grid>
      ) : (
        <Paper variant="outlined"><Table size="small" aria-label="Hospitals"><TableHead><TableRow>{['Hospital', 'Code', 'City', 'Phone', 'Status'].map((h) => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>{visible.map((h) => <TableRow key={h.id} hover sx={{ cursor: 'pointer' }} onClick={() => open(h.id)}><TableCell>{h.name}{activeHospitalId === h.id && <Chip size="small" color="primary" label="active" sx={{ ml: 1 }} />}</TableCell><TableCell>{h.code}</TableCell><TableCell>{h.city ?? '—'}</TableCell><TableCell>{h.phone ?? '—'}</TableCell><TableCell>{h.active ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></Paper>
      ))}
    </>
  );
}
