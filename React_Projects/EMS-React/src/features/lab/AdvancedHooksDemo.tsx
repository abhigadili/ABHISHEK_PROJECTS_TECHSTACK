import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import {
  forwardRef,
  memo,
  useActionState,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/* useLayoutEffect: measure the DOM synchronously after layout, before paint */
function MeasuredBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <Box
      ref={ref}
      sx={{ border: '1px dashed', p: 1, resize: 'horizontal', overflow: 'auto', maxWidth: '100%' }}
    >
      Drag my corner — measured width: <b data-testid="measured">{width}px</b>
    </Box>
  );
}

/* useImperativeHandle + forwardRef: expose a small command API instead of the raw DOM node */
interface PromptHandle {
  focus: () => void;
  clear: () => void;
  shake: () => void;
}
const Prompt = forwardRef<PromptHandle, { label: string }>(function Prompt({ label }, ref) {
  const input = useRef<HTMLInputElement>(null);
  const [shaking, setShaking] = useState(false);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => input.current?.focus(),
      clear: () => {
        if (input.current) input.current.value = '';
      },
      shake: () => {
        setShaking(true);
        setTimeout(() => setShaking(false), 400);
      },
    }),
    [],
  );
  return (
    <TextField
      inputRef={input}
      label={label}
      size="small"
      sx={{ transform: shaking ? 'translateX(6px)' : 'none', transition: 'transform .1s' }}
    />
  );
});

/* useId: stable unique ids (SSR-safe) for label ↔ input wiring */
function LabelledInput({ label }: { label: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label} </label>
      <input id={id} />
      <code> id="{id}"</code>
    </div>
  );
}

/* useTransition + useDeferredValue: keep typing responsive while rendering a heavy list */
const Heavy = memo(function Heavy({ q }: { q: string }) {
  const rows = [];
  for (let i = 0; i < 1500; i += 1) if (`employee ${i}`.includes(q)) rows.push(<li key={i}>employee {i}</li>);
  return (
    <ul style={{ maxHeight: 80, overflow: 'auto', margin: 0 }}>
      {rows.slice(0, 60)}
      <li>… {rows.length} matches</li>
    </ul>
  );
});

/* useOptimistic + useActionState (React 19) */
async function fakeSave(_prev: { saved: string[] }, formData: FormData) {
  await new Promise((r) => setTimeout(r, 600));
  return { saved: [..._prev.saved, String(formData.get('todo'))] };
}
function OptimisticTodos() {
  const [state, action, pending] = useActionState(fakeSave, { saved: [] });
  const [optimistic, add] = useOptimistic(state.saved, (cur, next: string) => [...cur, `${next} (saving…)`]);
  return (
    <form
      action={(fd) => {
        add(String(fd.get('todo')));
        return action(fd);
      }}
    >
      <Stack direction="row" spacing={1}>
        <TextField name="todo" label="New to-do" size="small" required />
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </Stack>
      <ul data-testid="todos">
        {optimistic.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </form>
  );
}

/* useEffectEvent: an effect that reads the LATEST value without re-subscribing when it changes */
function Ticker() {
  const [step, setStep] = useState(1);
  const [value, setValue] = useState(0);
  const onTick = useEffectEvent(() => setValue((v) => v + step)); // always sees the current `step`
  useEffect(() => {
    const id = setInterval(onTick, 1000);
    return () => clearInterval(id);
  }, []); // runs once; step changes do NOT restart the timer
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip label={`value ${value}`} />
      <Button size="small" onClick={() => setStep((s) => s + 1)}>
        step = {step}
      </Button>
    </Stack>
  );
}

/* useInsertionEffect: the one genuine use — a CSS-in-JS style injector must add <style> rules BEFORE layout effects read layout */
let injected = 0;
function useInjectedStyle(css: string) {
  useInsertionEffect(() => {
    const tag = document.createElement('style');
    tag.dataset.lab = String(++injected);
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, [css]);
}
function Injected() {
  useInjectedStyle('.lab-injected{outline:2px solid #00897b;padding:4px;border-radius:4px}');
  return <span className="lab-injected">Styled by a rule injected with useInsertionEffect</span>;
}

export default function AdvancedHooksDemo() {
  const online = useOnlineStatus(); // useSyncExternalStore + useDebugValue (see hooks/useOnlineStatus.ts)
  const prompt = useRef<PromptHandle>(null);
  const [text, setText] = useState('');
  const deferred = useDeferredValue(text);
  const [tab, setTab] = useState('a');
  const [pending, startTransition] = useTransition();
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Isolated learning examples (not tied to an EMS screen). The same Hooks are also used in real screens —
        see docs/react-concepts/EMS-REACT-CONCEPT-MAPPING.md.
      </Alert>
      <Card>
        <CardContent>
          <Typography variant="h6">useLayoutEffect</Typography>
          <MeasuredBox />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">forwardRef + useImperativeHandle</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Prompt ref={prompt} label="Child input" />
            <Button onClick={() => prompt.current?.focus()}>focus()</Button>
            <Button onClick={() => prompt.current?.clear()}>clear()</Button>
            <Button onClick={() => prompt.current?.shake()}>shake()</Button>
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useId</Typography>
          <LabelledInput label="Name" />
          <LabelledInput label="Email" />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useDeferredValue</Typography>
          <TextField
            label="Filter 1 500 rows"
            size="small"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Box sx={{ opacity: deferred !== text ? 0.5 : 1 }}>
            <Heavy q={deferred} />
          </Box>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useTransition</Typography>
          <Stack direction="row" spacing={1}>
            {['a', 'b', 'c'].map((t) => (
              <Button
                key={t}
                variant={tab === t ? 'contained' : 'outlined'}
                onClick={() => startTransition(() => setTab(t))}
              >
                Tab {t}
              </Button>
            ))}
          </Stack>
          <Typography variant="body2">
            Active: {tab} {pending && '(switching…)'}
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useSyncExternalStore · useDebugValue</Typography>
          <Chip color={online ? 'success' : 'error'} label={online ? 'Online' : 'Offline'} />{' '}
          <Typography variant="caption">
            Toggle your network in DevTools; open React DevTools to see the debug label.
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useActionState + useOptimistic</Typography>
          <OptimisticTodos />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useEffectEvent</Typography>
          <Ticker />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useInsertionEffect</Typography>
          <Injected />
        </CardContent>
      </Card>
    </Stack>
  );
}
