'use client';
import { memo } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/common/Avatar';
import { useOrganization } from '@/hooks/useOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import type { OrgNode } from '@/schemas/api';

interface NodeProps { n: OrgNode; expanded: Set<number>; ancestors: Set<number>; matches: Set<number>; toggle: (id: number) => void; canEdit: boolean }

/** `memo`: toggling one branch (or typing in the search box) re-renders only the nodes whose props changed. Stable ids as keys keep DOM nodes attached to the right person. */
const Node = memo(function Node({ n, expanded, ancestors, matches, toggle, canEdit }: NodeProps) {
  const open = expanded.has(n.id) || ancestors.has(n.id); // a search reveals the path to every match
  const hit = matches.has(n.id);
  return (
    <li>
      <div className={`org-card ${hit ? 'ring-2 ring-primary' : ''}`} data-testid={`org-node-${n.id}`} data-match={hit}>
        <Avatar employeeId={n.id} name={n.name} hasPicture={!!n.profilePictureUrl} size={40} />
        <Link href={`/employees/${n.id}`} className="font-medium text-primary hover:underline">{n.name}</Link>
        <span className="text-xs text-muted">{n.jobTitle ?? n.designation ?? ''}</span>
        {canEdit && <Link href={`/employees/${n.id}/edit`} className="text-xs underline">Edit</Link>}
        {n.subordinates.length > 0 && <button type="button" onClick={() => toggle(n.id)} aria-expanded={open} className="mt-1 text-xs underline">{open ? 'Collapse' : `Expand (${n.subordinates.length})`}</button>}
      </div>
      {open && n.subordinates.length > 0 && <ul>{n.subordinates.map((s) => <Node key={s.id} n={s} expanded={expanded} ancestors={ancestors} matches={matches} toggle={toggle} canEdit={canEdit} />)}</ul>}
    </li>
  );
});

/** Interactive org chart (client island). The hierarchy is fetched on the server and passed in as serialisable props; the expand/search logic lives in `useOrganization`. */
export function OrgTree({ roots }: { roots: OrgNode[] }) {
  const { expanded, ancestors, matches, term, setTerm, toggle, searching, expandAll, collapseAll } = useOrganization(roots);
  const { can } = usePermissions();
  const canEdit = can('employee:manage'); // a courtesy: the edit page and the API enforce access themselves
  const q = term.trim();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search the chart" aria-label="Search the organization chart" className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        <button type="button" onClick={expandAll} className="rounded-lg border border-border px-3 py-2 text-sm">Expand all</button>
        <button type="button" onClick={collapseAll} className="rounded-lg border border-border px-3 py-2 text-sm">Collapse all</button>
      </div>
      {q && <p className="mb-2 text-sm text-muted" role="status" data-testid="org-search-status">{searching ? 'Searching…' : matches.size === 0 ? `No one matches “${q}”.` : `${matches.size} match${matches.size === 1 ? '' : 'es'} highlighted`}</p>}
      <div className="overflow-x-auto pb-4"><ul className="org-tree" data-testid="org-tree">{roots.map((r) => <Node key={r.id} n={r} expanded={expanded} ancestors={ancestors} matches={matches} toggle={toggle} canEdit={canEdit} />)}</ul></div>
    </div>
  );
}
