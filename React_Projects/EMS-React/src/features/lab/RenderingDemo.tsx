import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { memo, useCallback, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { VirtualList } from '@/components/common/VirtualList';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

/* Keys & reconciliation: with index keys React reuses the wrong DOM node's input state after a reorder */
function KeyedList({ stable }: { stable: boolean }) {
  const [items, setItems] = useState([
    { id: 'a', n: 'Ann' },
    { id: 'b', n: 'Ben' },
    { id: 'c', n: 'Cy' },
  ]);
  return (
    <Stack spacing={1}>
      {items.map((it, i) => (
        <div key={stable ? it.id : i}>
          {it.n}:{' '}
          <input
            defaultValue=""
            placeholder="type here"
            aria-label={`${stable ? 'stable' : 'index'}-${it.n}`}
          />
        </div>
      ))}
      <Button size="small" onClick={() => setItems((x) => [...x].reverse())}>
        Reverse order
      </Button>
    </Stack>
  );
}

/* Re-render counting: memo + stable callback vs. a fresh function every render */
const Row = memo(function Row({ label, onPick }: { label: string; onPick: (l: string) => void }) {
  const r = useRef(0);
  r.current += 1;
  return (
    <Button size="small" onClick={() => onPick(label)}>
      {label} · {r.current} render(s)
    </Button>
  );
});
function MemoDemo() {
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState('');
  const stable = useCallback((l: string) => setPicked(l), []);
  return (
    <Stack spacing={1}>
      <Button variant="outlined" onClick={() => setN((x) => x + 1)}>
        Re-render parent ({n})
      </Button>
      <Stack direction="row" spacing={1}>
        <Row label="stable" onPick={stable} />
        <Row label="inline" onPick={(l) => setPicked(l)} />
      </Stack>
      <Typography variant="caption">
        “stable” keeps its count (memo + useCallback); “inline” re-renders each time because its prop is a new
        function. Picked: {picked || '—'}
      </Typography>
    </Stack>
  );
}

/* Portal tooltip: rendered into <body>, so a parent's overflow:hidden can't clip it */
function PortalTip({ text, children }: { text: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <span
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left, y: r.bottom + 6 });
      }}
      onMouseLeave={() => setPos(null)}
      style={{ textDecoration: 'underline dotted', cursor: 'help' }}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              background: '#222',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              zIndex: 2000,
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}

function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('Boom: a render-time error (caught by the boundary)');
  return <span>Safe ✔</span>;
}

export default function RenderingDemo() {
  const [armed, setArmed] = useState(false);
  const big = useRef(Array.from({ length: 5000 }, (_, i) => `Row ${i + 1}`)).current;
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Reconciliation, keys, memoisation, virtualisation, portals, error boundaries. Fragments are used
        throughout the app (<code>&lt;&gt;…&lt;/&gt;</code>).
      </Alert>
      <Card>
        <CardContent>
          <Typography variant="h6">Keys: index vs stable id</Typography>
          <Typography variant="caption">
            Type in the first box of each list, then Reverse. With <b>index</b> keys the typed text stays in
            the first row (wrong person); with <b>stable</b> keys it follows its row.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mt: 1 }}>
            <div>
              <b>index keys</b>
              <KeyedList stable={false} />
            </div>
            <div>
              <b>stable keys</b>
              <KeyedList stable />
            </div>
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">React.memo + useCallback</Typography>
          <MemoDemo />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Virtualised list (5 000 rows)</Typography>
          <VirtualList
            items={big}
            rowHeight={28}
            height={140}
            getKey={(_, i) => i}
            renderRow={(r) => (
              <Box sx={{ px: 1, lineHeight: '28px', borderBottom: 1, borderColor: 'divider' }}>{r}</Box>
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Portal</Typography>
          <Box sx={{ overflow: 'hidden', height: 28, border: '1px dashed', px: 1 }}>
            <PortalTip text="I escape the clipped parent via createPortal">Hover me</PortalTip>
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">Error boundary</Typography>
          <ErrorBoundary
            resetKeys={[armed]}
            fallback={(e, reset) => (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setArmed(false);
                      reset();
                    }}
                  >
                    Recover
                  </Button>
                }
              >
                {e.message}
              </Alert>
            )}
          >
            <Bomb armed={armed} />
          </ErrorBoundary>
          <Button color="error" size="small" onClick={() => setArmed(true)} sx={{ ml: 1 }}>
            Throw during render
          </Button>
          <Typography variant="caption" display="block">
            Boundaries catch render errors only; API failures use RTK Query <code>isError</code> / try-catch /
            the Axios interceptor.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
