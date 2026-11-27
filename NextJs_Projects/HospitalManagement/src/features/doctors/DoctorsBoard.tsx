'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Skeleton, TextField } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/redux/hooks';
import { doctorsActions, fetchDoctors, selectDoctorsState, selectSpecializations, selectVisibleDoctors, type DoctorSort } from '@/store/slices/doctorsSlice';
import { doctorsApi } from '@/services/api/clientApis';
import { keys } from '@/services/queryKeys';
import { useShortlist } from '@/store/zustand/shortlistStore';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/common/Avatar';
import { formatCurrency } from '@/lib/utilities/format';
import { useState } from 'react';

/**
 * Doctor management board. Redux Toolkit owns the list (entity adapter + thunk + memoised selectors), TanStack Query owns the
 * specialization lookup (initialData from the server), Zustand owns the persisted shortlist. Search is debounced.
 */
export function DoctorsBoard({ initialSpecializations }: { initialSpecializations: string[] }) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, error, search, specialization, onlyActive, sort } = useAppSelector(selectDoctorsState);
  const doctors = useAppSelector(selectVisibleDoctors);
  const derivedSpecs = useAppSelector(selectSpecializations);
  const shortlist = useShortlist((s) => s.ids);
  const toggle = useShortlist((s) => s.toggle);
  const [text, setText] = useState(search);
  const debounced = useDebounce(text, 300);

  // Server State via TanStack Query with Initial Data from the Server Component (no loading flash)
  const specs = useQuery({ queryKey: keys.doctors.specs, queryFn: ({ signal }) => doctorsApi.specializations(signal), initialData: initialSpecializations, staleTime: 5 * 60_000 });
  useEffect(() => { if (store.getState().doctors.status === 'idle') { const p = dispatch(fetchDoctors()); return () => p.abort(); } }, [dispatch, store]);
  useEffect(() => { dispatch(doctorsActions.setSearch(debounced)); }, [debounced, dispatch]);

  const options = specs.data?.length ? specs.data : derivedSpecs;
  return (
    <div className="space-y-4">
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField label="Search doctors" value={text} onChange={(e) => setText(e.target.value)} sx={{ minWidth: 220, flex: 1 }} />
        <TextField select label="Specialization" value={specialization} onChange={(e) => dispatch(doctorsActions.setSpecialization(e.target.value))} sx={{ minWidth: 200 }}><MenuItem value="">All</MenuItem>{options.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
        <TextField select label="Sort by" value={sort} onChange={(e) => dispatch(doctorsActions.setSort(e.target.value as DoctorSort))} sx={{ minWidth: 160 }}><MenuItem value="name">Name</MenuItem><MenuItem value="experience">Experience</MenuItem><MenuItem value="fee">Fee (low to high)</MenuItem></TextField>
        <FormControlLabel control={<Checkbox checked={onlyActive} onChange={(e) => dispatch(doctorsActions.setOnlyActive(e.target.checked))} />} label="Active only" />
        <Button onClick={() => { setText(''); dispatch(doctorsActions.resetFilters()); }}>Reset</Button>
      </Paper>
      {shortlist.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Shortlist:</span>{shortlist.map((id) => <Chip key={id} size="small" label={`Doctor #${id}`} component={Link} href={`/appointments/book?doctorId=${id}`} clickable onDelete={() => toggle(id)} />)}</div>}
      {status === 'loading' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={110} />)}</div>}
      {status === 'failed' && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => dispatch(fetchDoctors())}>Retry</Button>}>{error}</Alert>}
      {status === 'succeeded' && (doctors.length === 0 ? <Alert severity="info">No doctors match the current filters.</Alert> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <Paper key={d.id} variant="outlined" sx={{ p: 2 }} onMouseEnter={() => { router.prefetch(`/doctors/${d.id}`); void qc.prefetchQuery({ queryKey: keys.doctors.available(new Date().toISOString().slice(0, 10)), queryFn: ({ signal }) => doctorsApi.available(new Date().toISOString().slice(0, 10), undefined, signal) }); }}>
              <div className="flex gap-3"><Avatar name={d.fullName} size={48} />
                <div className="min-w-0 flex-1"><Link href={`/doctors/${d.id}`} className="block truncate font-semibold hover:underline">{d.fullName}</Link><p className="text-sm text-primary">{d.specialization}</p><p className="text-xs text-muted">{d.experienceYears ?? '—'} yrs · {formatCurrency(d.consultationFee)}</p></div>
                <button aria-label={shortlist.includes(d.id) ? 'Remove from shortlist' : 'Add to shortlist'} onClick={() => toggle(d.id)} className="cursor-pointer text-warn">{shortlist.includes(d.id) ? <StarIcon /> : <StarBorderIcon />}</button></div>
              {!d.active && <Chip size="small" label="Inactive" sx={{ mt: 1 }} />}
            </Paper>
          ))}
        </div>
      ))}
    </div>
  );
}
