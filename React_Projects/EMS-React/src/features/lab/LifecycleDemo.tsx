import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { LegacyCounter } from './patterns/LegacyCounter';

/** Logs what the component does, in order, so mount / update / unmount (and StrictMode's extra mount) are visible. */
function Probe({ label, log }: { label: string; log: (m: string) => void }) {
  const [count, setCount] = useState(0);
  const renders = useRef(0);
  renders.current += 1; // reading/writing a ref during render is only OK for harmless diagnostics like this counter

  useEffect(() => {
    log(`${label}: mounted`);
    return () => log(`${label}: unmounted (cleanup)`);
  }, [label, log]); // [] ≈ componentDidMount + componentWillUnmount
  useEffect(() => {
    log(`${label}: effect ran after render with count=${count}`);
    return () => log(`${label}: cleanup before next effect (count was ${count})`);
  }, [count, label, log]); // [count] ≈ componentDidUpdate
  return (
    <Button onClick={() => setCount((c) => c + 1)} variant="outlined">
      {label} · count {count} · renders {renders.current}
    </Button>
  );
}

export default function LifecycleDemo() {
  const [show, setShow] = useState(true);
  const [showLegacy, setShowLegacy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const log = useRef((m: string) => setLines((l) => [...l.slice(-14), m])).current; // stable function identity

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Hooks equivalents of class lifecycle methods. In development <b>StrictMode</b> mounts every effect
        twice (mount → cleanup → mount) to prove your cleanup works — expect doubled "mounted" lines. Source:{' '}
        <code>features/lab/LifecycleDemo.tsx</code>
      </Alert>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="contained" onClick={() => setShow((s) => !s)}>
          {show ? 'Unmount' : 'Mount'} function component
        </Button>
        <Button variant="outlined" onClick={() => setShowLegacy((s) => !s)}>
          {showLegacy ? 'Unmount' : 'Mount'} class component (legacy)
        </Button>
        <Button onClick={() => setLines([])}>Clear log</Button>
      </Stack>
      <Stack direction="row" spacing={2}>
        {show && <Probe label="Probe" log={log} />}
        {showLegacy && <LegacyCounter onLog={log} />}
      </Stack>
      <Card>
        <CardContent>
          <Typography variant="subtitle2">Event log</Typography>
          <Box
            component="pre"
            data-testid="lifecycle-log"
            sx={{ m: 0, fontSize: 12, minHeight: 120, whiteSpace: 'pre-wrap' }}
          >
            {lines.join('\n') || 'Interact with the buttons…'}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
