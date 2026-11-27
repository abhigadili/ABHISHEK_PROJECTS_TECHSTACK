'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { ageFromDob, formatDate } from '@/lib/utilities/format';
import type { Patient } from '@/types';

type SortKey = 'name' | 'dateOfBirth' | 'status';
/**
 * MUI interactive table (Client Component). Rows arrive as props from the server page (server-side search + pagination);
 * this component adds CLIENT-SIDE filtering and sorting of the loaded page, and row navigation with router.push().
 */
export function PatientsTable({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const rows = useMemo(() => {
    const t = filter.trim().toLowerCase();
    const f = patients.filter((p) => !t || `${p.firstName} ${p.lastName} ${p.email} ${p.phone}`.toLowerCase().includes(t));
    const val = (p: Patient) => (sort.key === 'name' ? `${p.lastName} ${p.firstName}`.toLowerCase() : sort.key === 'dateOfBirth' ? p.dateOfBirth : p.status);
    return [...f].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1));
  }, [patients, filter, sort]);
  const head = (key: SortKey, label: string) => <TableSortLabel active={sort.key === key} direction={sort.dir} onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>{label}</TableSortLabel>;
  return (
    <Paper variant="outlined">
      <div className="p-3"><TextField placeholder="Filter this page…" value={filter} onChange={(e) => setFilter(e.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }, htmlInput: { 'aria-label': 'Filter patients on this page' } }} sx={{ maxWidth: 360 }} /></div>
      <TableContainer>
        <Table size="small" aria-label="Patients">
          <TableHead><TableRow><TableCell>{head('name', 'Patient')}</TableCell><TableCell>{head('dateOfBirth', 'Age / DOB')}</TableCell><TableCell>Gender</TableCell><TableCell>Phone</TableCell><TableCell>E-mail</TableCell><TableCell>{head('status', 'Status')}</TableCell></TableRow></TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} hover tabIndex={0} sx={{ cursor: 'pointer' }} onClick={() => router.push(`/patients/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && router.push(`/patients/${p.id}`)}>
                <TableCell><strong>{p.firstName} {p.lastName}</strong><div className="text-xs text-muted">ID {p.id}</div></TableCell>
                <TableCell>{ageFromDob(p.dateOfBirth) ?? '—'} yrs<div className="text-xs text-muted">{formatDate(p.dateOfBirth)}</div></TableCell>
                <TableCell>{p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}</TableCell>
                <TableCell>{p.phone}</TableCell><TableCell>{p.email}</TableCell>
                <TableCell><Chip size="small" label={p.status} color={p.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>No patients match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
