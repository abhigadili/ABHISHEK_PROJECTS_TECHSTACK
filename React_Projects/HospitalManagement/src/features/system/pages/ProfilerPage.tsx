import { useSyncExternalStore } from 'react';
import { Activity, RotateCcw } from 'lucide-react';
import { profilerStore } from '@/utils/profilerStore';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/common/Notice';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Shows the measurements collected by <Profiler> boundaries (patient list, doctor directory, record timeline, medicines, dashboard). */
export default function ProfilerPage() {
  const rows = useSyncExternalStore(profilerStore.subscribe, profilerStore.getSnapshot);
  return (
    <>
      <PageHeader title="Render profiler" subtitle="React <Profiler> measurements for the heaviest views" icon={<Activity className="h-5 w-5" />} actions={<Button variant="outline" onClick={() => profilerStore.reset()}><RotateCcw className="h-4 w-4" /> Reset</Button>} />
      <div className="mb-4"><Notice>Open Patients, Doctors, a patient's medical record, Medicines or the Dashboard, interact (search, page, hover), then come back here. <b>Actual</b> is the time spent rendering the committed update; <b>Base</b> is the estimated cost without memoisation. The development server always reports; a production build reports only when built with <code>VITE_PROFILING=true</code> (links react-dom's profiling build).</Notice></div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface"><Table aria-label="Profiler"><TableHeader><TableRow><TableHead>Profiled section</TableHead><TableHead className="text-right">Commits</TableHead><TableHead className="text-right">Mounts</TableHead><TableHead className="text-right">Updates</TableHead><TableHead className="text-right">Total actual (ms)</TableHead><TableHead className="text-right">Max (ms)</TableHead><TableHead className="text-right">Last actual / base (ms)</TableHead></TableRow></TableHeader>
        <TableBody>{rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted">Nothing measured yet.</TableCell></TableRow>}
          {rows.map((r) => <TableRow key={r.id}><TableCell className="font-semibold">{r.id}</TableCell><TableCell className="text-right">{r.commits}</TableCell><TableCell className="text-right">{r.mounts}</TableCell><TableCell className="text-right">{r.updates}</TableCell><TableCell className="text-right">{r.totalActual.toFixed(1)}</TableCell><TableCell className="text-right">{r.maxActual.toFixed(1)}</TableCell><TableCell className="text-right">{r.lastActual.toFixed(1)} / {r.lastBase.toFixed(1)}</TableCell></TableRow>)}</TableBody></Table></div>
    </>
  );
}
