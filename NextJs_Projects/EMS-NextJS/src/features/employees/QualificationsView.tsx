'use client';
import { useSyncExternalStore } from 'react';
import { loadQualifications } from '@/lib/client/qualifications';
import { Alert } from '@/components/common/ui';

const noop = () => () => {};
type R = Record<string, string>;
export function QualificationsView({ employeeId }: { employeeId: number }) {
  // useSyncExternalStore: server snapshot is "", client snapshot reads localStorage → no hydration mismatch
  const raw = useSyncExternalStore(noop, () => JSON.stringify(loadQualifications(employeeId)), () => '');
  const q = raw ? (JSON.parse(raw) as Record<string, R[]>) : {};
  const sections: [string, R[], (r: R) => string][] = [
    ['Education', q.education ?? [], (r) => `${r.degree} — ${r.institution} (${r.startYear}${r.endYear ? `–${r.endYear}` : ''})`],
    ['Experience', q.experience ?? [], (r) => `${r.title} at ${r.company} (${r.startDate}${r.endDate ? ` → ${r.endDate}` : ' → present'})`],
    ['Skills', q.skills ?? [], (r) => `${r.name} · ${r.level?.toLowerCase()}`],
    ['Certifications', q.certifications ?? [], (r) => `${r.name} — ${r.issuer} (${r.year})`],
  ];
  return (
    <div className="space-y-3"><Alert kind="info">Stored in this browser only — the backend has no endpoint for these.</Alert>
      {sections.map(([t, rows, fmt]) => <div key={t}><h3 className="text-sm font-medium">{t}</h3>{rows.length ? <ul className="list-disc pl-5 text-sm">{rows.map((r, i) => <li key={i}>{fmt(r)}</li>)}</ul> : <p className="text-sm text-muted">None recorded.</p>}</div>)}</div>
  );
}
