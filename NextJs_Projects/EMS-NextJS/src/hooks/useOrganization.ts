'use client';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { OrgNode } from '@/schemas/api';

/** Expand/collapse + search state for the org chart. The tree itself arrives as a prop from the Server Component (no client fetch). */
export function useOrganization(roots: OrgNode[]) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(roots.map((r) => r.id)));
  const [term, setTerm] = useState('');
  const deferred = useDeferredValue(term.trim().toLowerCase()); // typing stays responsive while a big tree is re-filtered
  const toggle = useCallback((id: number) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const { matches, ancestors } = useMemo(() => {
    const m = new Set<number>(); const a = new Set<number>();
    if (!deferred) return { matches: m, ancestors: a };
    const walk = (n: OrgNode, path: number[]): boolean => {
      const hit = `${n.name} ${n.jobTitle ?? ''} ${n.department?.name ?? ''} ${n.employeeCode}`.toLowerCase().includes(deferred);
      let childHit = false;
      for (const c of n.subordinates) if (walk(c, [...path, n.id])) childHit = true;
      if (hit) { m.add(n.id); path.forEach((p) => a.add(p)); }
      if (childHit) a.add(n.id);
      return hit || childHit;
    };
    roots.forEach((r) => walk(r, []));
    return { matches: m, ancestors: a };
  }, [deferred, roots]);
  const expandAll = useCallback(() => { const ids = new Set<number>(); const w = (n: OrgNode) => { if (n.subordinates.length) { ids.add(n.id); n.subordinates.forEach(w); } }; roots.forEach(w); setExpanded(ids); }, [roots]);
  return { expanded, toggle, term, setTerm, matches, ancestors, searching: term.trim().toLowerCase() !== deferred, expandAll, collapseAll: () => setExpanded(new Set()) };
}
