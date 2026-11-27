import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { OrgTree } from './OrgTree';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { SearchBox } from '@/components/tables/SearchBox';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { useOrganization } from '@/hooks/useOrganization';
import { useApi } from '@/hooks/useApi';
import { useDepartmentFilter, useDepartments } from '@/hooks/useDepartments';
import { organizationApi } from '@/services/organizationApi';
import type { OrgNode } from '@/types/api';

function findNode(roots: OrgNode[], id: number): OrgNode | null {
  for (const r of roots) {
    if (r.id === id) return r;
    const hit = findNode(r.subordinates, id);
    if (hit) return hit;
  }
  return null;
}

export default function OrganizationPage() {
  const [deptId, setDeptId] = useDepartmentFilter();
  const { options } = useDepartments();
  const org = useOrganization(deptId ?? undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const chain = useApi((signal, id: number) => organizationApi.reportingChain(id, signal));
  const { run: loadChain } = chain;

  // deferring the hit list keeps typing responsive while a long result list re-renders
  const hits = useDeferredValue(org.hits);
  const highlightIds = useMemo(() => new Set(hits.map((h) => h.id)), [hits]);

  const select = useCallback(
    (id: number) => {
      setSelectedId(id);
      void loadChain(id);
    },
    [loadChain],
  );
  const selected = useMemo(
    () => (org.chart && selectedId ? findNode(org.chart.roots, selectedId) : null),
    [org.chart, selectedId],
  );

  const pickHit = (id: number, chainIds: number[]) => {
    org.reveal(chainIds);
    select(id);
  };

  if (org.loading && !org.chart) return <Loading page label="Loading organization…" />;
  if (org.error)
    return <ErrorMessage message={org.error} onRetry={() => void org.reload(deptId ?? undefined)} />;

  return (
    <>
      <PageHeader
        title="Organization chart"
        subtitle={
          org.chart ? `${org.chart.totalNodes} people · built live from reporting relationships` : undefined
        }
        actions={
          <>
            <Button onClick={org.expandAll}>Expand all</Button>
            <Button onClick={org.collapseAll}>Collapse all</Button>
          </>
        }
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 280 }}>
          <SearchBox
            value={org.term}
            onChange={org.setTerm}
            placeholder="Find a person (2+ letters)"
            label="Find employee"
          />
        </Box>
        <FilterSelect
          label="Department"
          value={deptId ? String(deptId) : ''}
          options={options}
          onChange={(v) => setDeptId(v ? Number(v) : null)}
        />
      </Stack>
      {org.term.trim().length >= 2 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              {org.searching ? 'Searching…' : `${hits.length} match${hits.length === 1 ? '' : 'es'}`}
            </Typography>
            <List dense disablePadding>
              {hits.slice(0, 8).map((h) => (
                <ListItemButton key={h.id} onClick={() => pickHit(h.id, h.managerChainIds)}>
                  <ListItemText
                    primary={h.name}
                    secondary={`${h.jobTitle ?? h.designation ?? ''} · ${h.department?.name ?? 'No department'}`}
                  />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 320px' } }}>
        <Card sx={{ minWidth: 0 }}>
          {org.chart && org.chart.roots.length > 0 ? (
            <OrgTree
              roots={org.chart.roots}
              expanded={org.expanded}
              selectedId={selectedId}
              highlightIds={highlightIds}
              onToggle={org.toggle}
              onSelect={select}
            />
          ) : (
            <Alert severity="info" sx={{ m: 2 }}>
              No reporting relationships to show{deptId ? ' for this department' : ''}.
            </Alert>
          )}
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Selected
            </Typography>
            {!selected ? (
              <Typography color="text.secondary">
                Click a person to see their reporting chain and direct reports.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <div>
                  <Typography fontWeight={700}>{selected.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selected.jobTitle ?? selected.designation} · {selected.department?.name ?? '—'}
                  </Typography>
                </div>
                <Typography variant="body2">
                  {selected.directReportCount} direct report{selected.directReportCount === 1 ? '' : 's'}
                </Typography>
                {selected.subordinates.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {selected.subordinates.map((s) => s.name).join(', ')}
                  </Typography>
                )}
                <Typography variant="subtitle2">Reporting chain</Typography>
                {chain.loading ? (
                  <Loading />
                ) : (
                  <Typography variant="body2">
                    {chain.data?.chain.length
                      ? chain.data.chain.map((c) => c.name).join(' → ')
                      : 'Top of the organization'}
                  </Typography>
                )}
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/employees/${selected.id}`}
                    variant="contained"
                  >
                    Employee details
                  </Button>
                  <Button size="small" component={RouterLink} to={`/organization/${selected.id}`}>
                    Open chain
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}
