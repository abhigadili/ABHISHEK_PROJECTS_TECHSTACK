import { useCallback, useDeferredValue, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, Paper, Select, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Typography } from '@mui/material';
import PersonAddAlt1 from '@mui/icons-material/PersonAddAlt1';
import { usePatientList, usePrefetchPatient } from '../hooks/usePatients';
import { PatientRow } from '../components/PatientRow';
import { SearchInput, type SearchInputHandle } from '@/components/common/SearchInput';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ProfiledSection } from '@/components/common/ProfiledSection';
import { useUrlState } from '@/hooks/useUrlState';
import { useCan } from '@/contexts/AuthContext';

const KEYS = ['q', 'page', 'size'] as const;

/**
 * Patient directory (MUI). Filters/pagination are URL state (useSearchParams), the search box is debounced, the list is
 * server-paged through GET /patients?q=&page=&size=. useDeferredValue keeps typing responsive while the table updates.
 */
export default function PatientListPage() {
  const [f, setF] = useUrlState(KEYS, { size: '10' });
  const navigate = useNavigate();
  const canCreate = useCan('patients:create');
  const canEdit = useCan('patients:update');
  const searchRef = useRef<SearchInputHandle>(null);
  const page = Number(f.page) || 0;
  const size = Number(f.size) || 10;
  const query = usePatientList({ q: f.q || undefined, page, size });
  const prefetchPatient = usePrefetchPatient();
  const rows = useDeferredValue(query.data?.content ?? []);

  // useCallback => stable identities so memoised PatientRow children do not re-render needlessly
  const open = useCallback((id: number) => navigate(`/patients/${id}`), [navigate]);
  const edit = useCallback((id: number) => navigate(`/patients/${id}/edit`), [navigate]);
  const hover = useCallback((id: number) => void prefetchPatient(id), [prefetchPatient]);

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Search, review and manage registered patients"
        actions={canCreate && <Button variant="contained" startIcon={<PersonAddAlt1 />} onClick={() => navigate('/patients/new')}>Register patient</Button>}
      />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <SearchInput ref={searchRef} value={f.q} onSearch={(q) => setF({ q })} placeholder="Search name, e-mail or phone ( / )" />
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">Rows</Typography>
        <Select size="small" value={size} onChange={(e) => setF({ size: Number(e.target.value), page: 0 })} inputProps={{ 'aria-label': 'Rows per page' }}>
          {[5, 10, 20, 50].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </Select>
      </Stack>

      {query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ProfiledSection id="PatientList">
          <Paper variant="outlined" sx={{ opacity: query.isPlaceholderData ? 0.6 : 1, transition: 'opacity .15s' }}>
            <TableContainer>
              <Table size="medium" aria-label="Patients">
                <TableHead>
                  <TableRow>
                    {['Patient', 'Age · Gender', 'Blood', 'Contact', 'Registered', 'Status', ''].map((h, i) => <TableCell key={i} sx={{ fontWeight: 700 }} align={i === 6 ? 'right' : 'left'}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.isPending && Array.from({ length: 5 }, (_, i) => <TableRow key={i}>{Array.from({ length: 7 }, (_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>)}
                  {rows.map((p) => <PatientRow key={p.id} patient={p} canEdit={canEdit} onOpen={open} onEdit={edit} onHover={hover} />)}
                </TableBody>
              </Table>
            </TableContainer>
            {query.data && query.data.totalElements === 0 && (
              <Box p={3}>
                <EmptyState title={f.q ? 'No patients match your search' : 'No patients registered yet'} description={f.q ? 'Try a different name, e-mail or phone number.' : 'Register the first patient to get started.'} />
              </Box>
            )}
            {query.data && query.data.totalElements > 0 && (
              <TablePagination
                component="div"
                count={query.data.totalElements}
                page={query.data.page}
                rowsPerPage={query.data.size}
                rowsPerPageOptions={[]}
                onPageChange={(_e, p) => setF({ page: p }, { keepPage: true })}
              />
            )}
          </Paper>
        </ProfiledSection>
      )}
      {query.isError && query.data && <Alert severity="warning" sx={{ mt: 2 }}>Could not refresh the list - showing the last loaded data.</Alert>}
    </>
  );
}
