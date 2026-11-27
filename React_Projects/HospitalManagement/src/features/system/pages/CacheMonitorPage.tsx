import { useMemo, useState, useSyncExternalStore } from 'react';
import { useIsFetching, useIsMutating, useQueryClient, type Query } from '@tanstack/react-query';
import { Database, Eraser, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { queryKeys } from '@/services/queryKeys';
import { formatDateTime } from '@/utils/format';

/** Subscribe to the Query Cache / Mutation Cache with useSyncExternalStore (snapshot = a version counter bumped on every cache event). */
function useCacheVersion(kind: 'query' | 'mutation') {
  const qc = useQueryClient();
  const cache = kind === 'query' ? qc.getQueryCache() : qc.getMutationCache();
  return useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () => (kind === 'query' ? qc.getQueryCache().getAll().length * 1000 + qc.getQueryCache().getAll().reduce((a, q) => a + q.state.dataUpdateCount + q.state.errorUpdateCount + (q.state.fetchStatus === 'fetching' ? 1 : 0) + q.getObserversCount(), 0) : qc.getMutationCache().getAll().reduce((a, m) => a + m.state.submittedAt + (m.state.status === 'pending' ? 1 : 0), qc.getMutationCache().getAll().length)),
  );
}

const statusVariant = (q: Query): BadgeVariant => (q.state.status === 'error' ? 'danger' : q.state.fetchStatus === 'fetching' ? 'info' : q.isStale() ? 'warning' : 'success');
const statusLabel = (q: Query) => (q.state.fetchStatus === 'fetching' ? 'fetching' : q.state.fetchStatus === 'paused' ? 'paused' : q.state.status === 'error' ? 'error' : q.getObserversCount() === 0 ? 'inactive' : q.isStale() ? 'stale' : 'fresh');

export default function CacheMonitorPage() {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  useCacheVersion('query');
  useCacheVersion('mutation');
  const [filter, setFilter] = useState('');
  const defaults = qc.getDefaultOptions();
  const queries = qc.getQueryCache().getAll();
  const mutations = qc.getMutationCache().getAll();
  const visible = useMemo(() => queries.filter((q) => !filter || q.queryHash.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt), [queries, filter]);
  const byRoot = useMemo(() => queries.reduce<Record<string, number>>((m, q) => { const k = String(q.queryKey[0]); m[k] = (m[k] ?? 0) + 1; return m; }, {}), [queries]);

  return (
    <>
      <PageHeader title="Cache monitor" subtitle="TanStack Query cache, mutation cache and defaults (administrators)" icon={<Database className="h-5 w-5" />}
        actions={<><Button variant="outline" onClick={() => void qc.invalidateQueries()}><RefreshCw className="h-4 w-4" /> Invalidate all</Button><Button variant="outline" onClick={() => void qc.resetQueries()}><RotateCcw className="h-4 w-4" /> Reset all</Button><Button variant="destructive" onClick={() => qc.getQueryCache().clear()}><Trash2 className="h-4 w-4" /> Clear cache</Button></>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[['Cached queries', queries.length], ['Fetching now', fetching], ['Mutations running', mutating], ['Mutations in cache', mutations.length], ['Network', online ? 'online' : 'offline']].map(([k, v]) => <Card key={String(k)} className="p-4"><div className="text-xs font-semibold uppercase text-muted">{k}</div><div className="text-2xl font-bold">{v}</div></Card>)}
      </div>
      <Tabs defaultValue="queries">
        <TabsList><TabsTrigger value="queries">Queries ({queries.length})</TabsTrigger><TabsTrigger value="mutations">Mutations ({mutations.length})</TabsTrigger><TabsTrigger value="config">Defaults</TabsTrigger></TabsList>
        <TabsContent value="queries" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><SearchInput onSearch={setFilter} placeholder="Filter by key, e.g. appointments" />{Object.entries(byRoot).map(([k, n]) => <Badge key={k} variant="neutral">{k}: {n}</Badge>)}</div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface"><Table aria-label="Query cache"><TableHeader><TableRow><TableHead>Query key</TableHead><TableHead>State</TableHead><TableHead>Observers</TableHead><TableHead>Updated</TableHead><TableHead>Stale time</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{visible.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted">Cache is empty</TableCell></TableRow>}
              {visible.map((q) => (
                <TableRow key={q.queryHash}><TableCell className="max-w-[28rem] truncate font-mono text-xs" title={q.queryHash}>{q.queryHash}</TableCell><TableCell><Badge variant={statusVariant(q)}>{statusLabel(q)}</Badge></TableCell><TableCell>{q.getObserversCount()}</TableCell><TableCell className="text-xs text-muted">{q.state.dataUpdatedAt ? formatDateTime(new Date(q.state.dataUpdatedAt).toISOString()) : '—'}</TableCell><TableCell className="text-xs">{String((q.options as { staleTime?: unknown }).staleTime ?? 0)} ms</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Refetch" onClick={() => void q.fetch()}><RefreshCw className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Invalidate" onClick={() => void qc.invalidateQueries({ queryKey: q.queryKey, exact: true })}><Eraser className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Remove" onClick={() => qc.removeQueries({ queryKey: q.queryKey, exact: true })}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></TableCell></TableRow>
              ))}</TableBody></Table></div>
          <p className="text-xs text-muted">Refetch / Invalidate / Remove demonstrate <code>query.fetch</code>, <code>invalidateQueries</code> and <code>removeQueries</code>. "inactive" entries have no mounted observer and will be garbage-collected after gcTime ({String(defaults.queries?.gcTime)} ms).</p>
        </TabsContent>
        <TabsContent value="mutations"><div className="overflow-hidden rounded-xl border border-line bg-surface"><Table aria-label="Mutation cache"><TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead><TableHead>Failures</TableHead></TableRow></TableHeader><TableBody>
          {mutations.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted">No mutations yet - book an appointment or cancel an invoice.</TableCell></TableRow>}
          {[...mutations].reverse().slice(0, 50).map((m) => <TableRow key={m.mutationId}><TableCell className="font-mono text-xs">{m.options.mutationKey ? JSON.stringify(m.options.mutationKey) : `#${m.mutationId}`}</TableCell><TableCell><Badge variant={m.state.status === 'success' ? 'success' : m.state.status === 'error' ? 'danger' : m.state.status === 'pending' ? 'info' : 'neutral'}>{m.state.status}</Badge></TableCell><TableCell className="text-xs text-muted">{m.state.submittedAt ? formatDateTime(new Date(m.state.submittedAt).toISOString()) : '—'}</TableCell><TableCell>{m.state.failureCount}</TableCell></TableRow>)}</TableBody></Table></div></TabsContent>
        <TabsContent value="config">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5"><h3 className="mb-2 font-semibold">Client defaults</h3><dl className="grid grid-cols-2 gap-y-1.5 text-sm">{[['staleTime', defaults.queries?.staleTime], ['gcTime', defaults.queries?.gcTime], ['retry', 'shouldRetry(): no 4xx, max 2'], ['retryDelay', 'min(1000·2^n, 10 s)'], ['refetchOnWindowFocus', defaults.queries?.refetchOnWindowFocus], ['refetchOnReconnect', defaults.queries?.refetchOnReconnect], ['networkMode', defaults.queries?.networkMode], ['mutations.retry', defaults.mutations?.retry]].map(([k, v]) => [<dt key={`k${k}`} className="font-mono text-xs text-muted">{String(k)}</dt>, <dd key={`v${k}`}>{String(v)}</dd>])}</dl></Card>
            <Card className="p-5"><h3 className="mb-2 font-semibold">Query defaults per key (setQueryDefaults)</h3><ul className="space-y-1.5 text-sm">{[['hospitals', queryKeys.hospitals.all], ['specializations', queryKeys.doctors.specializations()], ['lab tests', queryKeys.laboratory.tests()], ['appointments availability', [...queryKeys.appointments.all, 'availability']], ['notifications', queryKeys.notifications.all]].map(([label, key]) => <li key={String(label)} className="flex justify-between"><span>{String(label)}</span><code className="text-xs text-muted">{JSON.stringify(qc.getQueryDefaults(key as readonly unknown[]))}</code></li>)}</ul>
              <h3 className="mb-2 mt-4 font-semibold">Mutation defaults (setMutationDefaults)</h3><ul className="space-y-1 text-sm"><li><code className="text-xs">["appointments","cancel"]</code> optimistic cancel with rollback</li><li><code className="text-xs">["billing","cancel"]</code> invoice cancel + invalidation</li></ul></Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
