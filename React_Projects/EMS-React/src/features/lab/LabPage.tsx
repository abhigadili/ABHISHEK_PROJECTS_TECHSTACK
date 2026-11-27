import { Alert, Tab, Tabs } from '@mui/material';
import { lazy, Suspense, useState, useTransition } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Loading } from '@/components/common/Feedback';

// each demo is its own chunk — also a live example of lazy + Suspense
const SECTIONS = {
  lifecycle: lazy(() => import('./LifecycleDemo')),
  basic: lazy(() => import('./BasicHooksDemo')),
  advanced: lazy(() => import('./AdvancedHooksDemo')),
  forms: lazy(() => import('./FormsDemo')),
  patterns: lazy(() => import('./PatternsDemo')),
  rendering: lazy(() => import('./RenderingDemo')),
};
type Key = keyof typeof SECTIONS;
const LABELS: Record<Key, string> = {
  lifecycle: 'Lifecycle',
  basic: 'Core Hooks',
  advanced: 'Advanced Hooks',
  forms: 'Controlled / uncontrolled',
  patterns: 'HOC · render props · compound',
  rendering: 'Keys · memo · portal · errors',
};

export default function LabPage() {
  const [tab, setTab] = useState<Key>('lifecycle');
  const [pending, startTransition] = useTransition();
  const Section = SECTIONS[tab];
  return (
    <>
      <PageHeader
        title="React Lab"
        subtitle="Isolated, clearly-labelled learning examples — separate from the business screens"
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Everything here is for learning. Real EMS features use the same concepts; see{' '}
        <code>docs/react-concepts/</code>.
      </Alert>
      <Tabs
        value={tab}
        onChange={(_, v) => startTransition(() => setTab(v))}
        variant="scrollable"
        sx={{ mb: 2 }}
      >
        {(Object.keys(SECTIONS) as Key[]).map((k) => (
          <Tab key={k} value={k} label={LABELS[k]} />
        ))}
      </Tabs>
      <div style={{ opacity: pending ? 0.6 : 1 }}>
        <Suspense fallback={<Loading />}>
          <Section />
        </Suspense>
      </div>
    </>
  );
}
