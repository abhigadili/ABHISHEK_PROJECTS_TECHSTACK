import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

/* useReducer: a state machine with explicit transitions — better than many useState calls when updates depend on each other */
interface CartState {
  items: { id: number; qty: number }[];
  log: string[];
}
type CartAction = { type: 'add'; id: number } | { type: 'remove'; id: number } | { type: 'clear' };
export function cartReducer(s: CartState, a: CartAction): CartState {
  switch (a.type) {
    case 'add': {
      const found = s.items.find((i) => i.id === a.id);
      return {
        items: found
          ? s.items.map((i) => (i.id === a.id ? { ...i, qty: i.qty + 1 } : i))
          : [...s.items, { id: a.id, qty: 1 }],
        log: [...s.log, `add ${a.id}`],
      };
    }
    case 'remove':
      return { items: s.items.filter((i) => i.id !== a.id), log: [...s.log, `remove ${a.id}`] };
    case 'clear':
      return { items: [], log: [...s.log, 'clear'] };
  }
}

/* useContext: read a value from the nearest Provider without prop drilling */
const GreetingContext = createContext('Hello');
const DeepChild = () => (
  <Typography>
    Deep child reads context: <b>{useContext(GreetingContext)}</b>
  </Typography>
);

/* memo + useCallback: the child skips re-rendering when its props are referentially equal */
const ExpensiveChild = memo(function ExpensiveChild({
  onPing,
  renders,
}: {
  onPing: () => void;
  renders: { current: number };
}) {
  renders.current += 1;
  return (
    <Button size="small" onClick={onPing}>
      Child (rendered {renders.current}×)
    </Button>
  );
});

export default function BasicHooksDemo() {
  // useState
  const [name, setName] = useState('');
  // useReducer
  const [cart, dispatch] = useReducer(cartReducer, { items: [], log: [] });
  // useRef: (1) DOM node  (2) mutable value that does NOT cause a re-render
  const inputRef = useRef<HTMLInputElement>(null);
  const clicks = useRef(0);
  const [, force] = useState(0);
  // useMemo: cache an expensive derived value
  const [n, setN] = useState(25);
  const fib = useMemo(() => {
    const f = (x: number): number => (x < 2 ? x : f(x - 1) + f(x - 2));
    return f(n);
  }, [n]);
  // useCallback + memo
  const [tick, setTick] = useState(0);
  const childRenders = useRef(0);
  const onPing = useCallback(() => {
    clicks.current += 1;
  }, []);
  // useEffect: sync with an external system (document title) and clean up
  useEffect(() => {
    const old = document.title;
    document.title = name ? `EMS · ${name}` : old;
    return () => {
      document.title = old;
    };
  }, [name]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6">useState + useEffect</Typography>
          <TextField
            label="Type a name (it also becomes the tab title — an effect with cleanup)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useReducer</Typography>
          <Stack direction="row" spacing={1} sx={{ my: 1 }}>
            {[1, 2, 3].map((id) => (
              <Button key={id} size="small" variant="outlined" onClick={() => dispatch({ type: 'add', id })}>
                Add #{id}
              </Button>
            ))}
            <Button size="small" onClick={() => dispatch({ type: 'clear' })}>
              Clear
            </Button>
          </Stack>
          <Typography variant="body2" data-testid="cart">
            {cart.items.length ? cart.items.map((i) => `#${i.id}×${i.qty}`).join(', ') : 'empty'} · actions:{' '}
            {cart.log.length}
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useRef</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1 }}>
            <TextField inputRef={inputRef} label="Uncontrolled input" size="small" />
            <Button onClick={() => inputRef.current?.focus()}>Focus it (DOM ref)</Button>
            <Button
              onClick={() => {
                clicks.current += 1;
                force((x) => x + 1);
              }}
            >
              Bump ref + re-render
            </Button>
          </Stack>
          <Typography variant="body2">
            Mutable ref value: {clicks.current} (changing a ref alone never re-renders)
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useMemo · useCallback · React.memo</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1 }} flexWrap="wrap" useFlexGap>
            <Button size="small" onClick={() => setN((x) => x + 1)}>
              fib({n}) = {fib}
            </Button>
            <Button size="small" onClick={() => setTick((t) => t + 1)}>
              Unrelated state: {tick}
            </Button>
            <ExpensiveChild onPing={onPing} renders={childRenders} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Click “Unrelated state”: fib is NOT recomputed and the memoised child does NOT re-render, because
            its props did not change.
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6">useContext</Typography>
          <GreetingContext.Provider value="Hello from a Provider">
            <Box>
              <DeepChild />
            </Box>
          </GreetingContext.Provider>
          <DeepChild />
        </CardContent>
      </Card>
    </Stack>
  );
}
