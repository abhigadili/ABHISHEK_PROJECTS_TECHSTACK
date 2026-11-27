import { Alert, Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { withLoading } from './patterns/withLoading';
import { List, MouseTracker } from './patterns/RenderProp';
import { Tabs } from './patterns/CompoundTabs';

const Names = ({ names }: { names: string[] }) => <Typography>{names.join(', ')}</Typography>;
const NamesWithLoading = withLoading(Names);

/** Props: children, default values, optional props, spread props, and a generic reusable component. */
function Panel({
  title,
  tone = 'neutral',
  children,
  ...rest
}: {
  title: string;
  tone?: 'neutral' | 'good';
  children?: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Box
      {...rest}
      sx={{ p: 1.5, border: 1, borderColor: tone === 'good' ? 'success.main' : 'divider', borderRadius: 2 }}
    >
      <b>{title}</b>
      <div>{children}</div>
    </Box>
  );
}

/** Lifting state up: two siblings communicate through the nearest common parent. */
function Sibling({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <button onClick={() => onChange(value + 1)}>
      {label}: {value}
    </button>
  );
}

export default function PatternsDemo() {
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(0);
  const people = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  const spread = { 'aria-label': 'spread demo', 'data-x': '1' };
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Advanced patterns as small, runnable examples. Each file is in <code>features/lab/patterns/</code>.
      </Alert>
      <Card>
        <CardContent>
          <Typography variant="h6">Higher-Order Component</Typography>
          <button onClick={() => setLoading((l) => !l)}>
            {loading ? 'Finish loading' : 'Start loading'}
          </button>
          <NamesWithLoading loading={loading} names={['Alice', 'Bob']} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Render props</Typography>
          <MouseTracker
            render={({ x, y }) => (
              <span data-testid="pos">
                pointer at {x},{y}
              </span>
            )}
          />
          <List<{ id: number; name: string }>
            items={people}
            getKey={(p) => p.id}
            renderItem={(p) => <b>{p.name}</b>}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Compound components</Typography>
          <Tabs defaultValue="one">
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="one">First panel</Tabs.Panel>
            <Tabs.Panel value="two">Second panel</Tabs.Panel>
          </Tabs>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Props, children, defaults, spread, state lifting</Typography>
          <Stack spacing={1}>
            <Panel title="Default tone">children go here</Panel>
            <Panel title="Optional prop + spread" tone="good" {...spread}>
              props spread onto the root element
            </Panel>
            <Stack direction="row" spacing={1}>
              <Sibling label="A" value={shared} onChange={setShared} />
              <Sibling label="B" value={shared} onChange={setShared} />
            </Stack>
            <Typography variant="caption">
              A and B share one value owned by their parent (lifted state).
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
