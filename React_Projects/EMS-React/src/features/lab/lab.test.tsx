import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BasicHooksDemo, { cartReducer } from './BasicHooksDemo';
import AdvancedHooksDemo from './AdvancedHooksDemo';
import LifecycleDemo from './LifecycleDemo';
import FormsDemo from './FormsDemo';
import PatternsDemo from './PatternsDemo';
import RenderingDemo from './RenderingDemo';
import { withLoading } from './patterns/withLoading';
import { Tabs } from './patterns/CompoundTabs';
import { MouseTracker } from './patterns/RenderProp';

describe('useReducer (cartReducer is a pure function)', () => {
  it('adds, increments, removes and clears without mutating', () => {
    const s0 = { items: [], log: [] };
    const s1 = cartReducer(s0, { type: 'add', id: 1 });
    const s2 = cartReducer(s1, { type: 'add', id: 1 });
    expect(s2.items).toEqual([{ id: 1, qty: 2 }]);
    expect(s0.items).toEqual([]); // untouched
    expect(cartReducer(s2, { type: 'remove', id: 1 }).items).toEqual([]);
    expect(cartReducer(s2, { type: 'clear' }).log).toEqual(['add 1', 'add 1', 'clear']);
  });
});

describe('Core Hooks demo', () => {
  it('useReducer drives the cart UI', async () => {
    render(<BasicHooksDemo />);
    await userEvent.click(screen.getByRole('button', { name: 'Add #2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add #2' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('#2×2 · actions: 2');
  });
  it('useRef gives imperative DOM access (focus)', async () => {
    render(<BasicHooksDemo />);
    await userEvent.click(screen.getByRole('button', { name: /Focus it/ }));
    expect(screen.getByLabelText('Uncontrolled input')).toHaveFocus();
  });
  it('useContext supplies the nearest Provider value', () => {
    render(<BasicHooksDemo />);
    expect(screen.getByText('Hello from a Provider')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument(); // default value outside the Provider
  });
  it('useEffect sets and CLEANS UP the document title', async () => {
    const original = document.title;
    const { unmount } = render(<BasicHooksDemo />);
    await userEvent.type(screen.getByLabelText(/Type a name/), 'Ada');
    expect(document.title).toBe('EMS · Ada');
    unmount();
    expect(document.title).toBe(original);
  });
  it('React.memo + useCallback: the memoised child does not re-render for unrelated state', async () => {
    render(<BasicHooksDemo />);
    const child = () => screen.getByRole('button', { name: /Child \(rendered/ }).textContent;
    const before = child();
    await userEvent.click(screen.getByRole('button', { name: /Unrelated state/ }));
    await userEvent.click(screen.getByRole('button', { name: /Unrelated state/ }));
    expect(child()).toBe(before);
  });
});

describe('Advanced Hooks demo', () => {
  it('useImperativeHandle exposes focus()/clear() on the child without exposing the DOM node', async () => {
    render(<AdvancedHooksDemo />);
    await userEvent.type(screen.getByLabelText('Child input'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'clear()' }));
    expect(screen.getByLabelText('Child input')).toHaveValue('');
    screen.getByRole('button', { name: 'focus()' }).click();
    await waitFor(() => expect(screen.getByLabelText('Child input')).toHaveFocus());
  });
  it('useId produces unique, stable ids that wire label to input', () => {
    render(<AdvancedHooksDemo />);
    const name = screen.getByLabelText('Name');
    const email = screen.getByLabelText('Email');
    expect(name.id).toBeTruthy();
    expect(name.id).not.toBe(email.id);
  });
  it('useDeferredValue keeps typing responsive and eventually shows the filtered result', async () => {
    render(<AdvancedHooksDemo />);
    await userEvent.type(screen.getByLabelText('Filter 1 500 rows'), '149');
    await waitFor(() => expect(screen.getByText(/… \d+ matches/)).toHaveTextContent('… 12 matches')); // 149, 1149, 1490–1499 → 12
  });
  it('useTransition marks tab switches as non-urgent but still switches', async () => {
    render(<AdvancedHooksDemo />);
    await userEvent.click(screen.getByRole('button', { name: 'Tab c' }));
    await waitFor(() => expect(screen.getByText(/Active: c/)).toBeInTheDocument());
  });
  it('useActionState + useOptimistic: item appears immediately as "saving…" then settles', async () => {
    render(<AdvancedHooksDemo />);
    await userEvent.type(screen.getByLabelText(/New to-do/), 'Write docs');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Write docs (saving…)')).toBeInTheDocument();
    await waitFor(
      () => expect(within(screen.getByTestId('todos')).getByText('Write docs')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
  it('useInsertionEffect injects a style rule and removes it on unmount', () => {
    const { unmount } = render(<AdvancedHooksDemo />);
    expect(document.head.querySelector('style[data-lab]')?.textContent).toContain('.lab-injected');
    unmount();
    expect(document.head.querySelector('style[data-lab]')).toBeNull();
  });
  it('useLayoutEffect measures the element synchronously', () => {
    render(<AdvancedHooksDemo />);
    expect(screen.getByTestId('measured')).toHaveTextContent('px');
  });
});

describe('Lifecycle demo (mount · update · unmount · cleanup)', () => {
  it('logs mount, update and unmount of a function component', async () => {
    render(<LifecycleDemo />);
    const log = () => screen.getByTestId('lifecycle-log').textContent!;
    expect(log()).toContain('Probe: mounted');
    await userEvent.click(screen.getByRole('button', { name: /Probe · count 0/ }));
    expect(log()).toMatch(/cleanup before next effect \(count was 0\)/);
    expect(log()).toMatch(/effect ran after render with count=1/);
    await userEvent.click(screen.getByRole('button', { name: /Unmount function component/ }));
    expect(log()).toContain('Probe: unmounted (cleanup)');
  });
  it('the legacy class component maps to the same phases', async () => {
    render(<LifecycleDemo />);
    await userEvent.click(screen.getByRole('button', { name: /Mount class component/ }));
    expect(screen.getByTestId('lifecycle-log')).toHaveTextContent('class: componentDidMount');
    await userEvent.click(screen.getByRole('button', { name: /Class counter/ }));
    expect(screen.getByTestId('lifecycle-log')).toHaveTextContent('class: componentDidUpdate (count 0 → 1)');
    await userEvent.click(screen.getByRole('button', { name: /Unmount class component/ }));
    expect(screen.getByTestId('lifecycle-log')).toHaveTextContent('class: componentWillUnmount');
  });
});

describe('Controlled vs uncontrolled', () => {
  it('controlled: React state mirrors every keystroke and validates live', async () => {
    render(<FormsDemo />);
    const box = screen.getByLabelText('Email (controlled)');
    await userEvent.type(box, 'nope');
    expect(screen.getByText('Not a valid email')).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, 'a@b.co');
    expect(screen.getByText('Live value: "a@b.co"')).toBeInTheDocument();
  });
  it('uncontrolled: the value is read from the DOM only on submit', async () => {
    render(<FormsDemo />);
    await userEvent.type(screen.getByLabelText('Email (uncontrolled)'), 'x@y.co');
    expect(screen.queryByText(/Read from the DOM/)).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Submit' })[1]);
    expect(screen.getByText('Read from the DOM: x@y.co')).toBeInTheDocument();
  });
});

describe('Patterns: HOC · render props · compound components', () => {
  it('HOC adds loading behaviour and a readable displayName', () => {
    const Inner = ({ label }: { label: string }) => <p>{label}</p>;
    const Wrapped = withLoading(Inner);
    const { rerender } = render(<Wrapped loading label="hi" />);
    expect(screen.queryByText('hi')).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<Wrapped loading={false} label="hi" />);
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(Wrapped.displayName).toBe('withLoading(Inner)');
  });
  it("render prop receives the tracker's state", () => {
    render(
      <MouseTracker
        render={({ x, y }) => (
          <span data-testid="p">
            {x},{y}
          </span>
        )}
      />,
    );
    fireEvent.mouseMove(screen.getByTestId('p').parentElement!, { clientX: 15, clientY: 7 });
    expect(screen.getByTestId('p')).toHaveTextContent('15,7');
  });
  it('compound Tabs share implicit state and expose ARIA roles', async () => {
    render(
      <Tabs defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">panel A</Tabs.Panel>
        <Tabs.Panel value="b">panel B</Tabs.Panel>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('panel B')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel B');
  });
  it('compound parts throw a helpful error outside <Tabs>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Tabs.Tab value="x">x</Tabs.Tab>)).toThrow(/inside <Tabs>/);
    spy.mockRestore();
  });
  it('the combined demo page: lifted state keeps siblings in sync; spread props reach the DOM', async () => {
    render(<PatternsDemo />);
    await userEvent.click(screen.getByRole('button', { name: 'A: 0' }));
    expect(screen.getByRole('button', { name: 'B: 1' })).toBeInTheDocument();
    expect(screen.getByLabelText('spread demo')).toHaveAttribute('data-x', '1');
  });
});

describe('Rendering: keys · memo · virtualisation · portal · error boundary', () => {
  it('STABLE keys keep typed text with its row after a reorder; INDEX keys do not', async () => {
    render(<RenderingDemo />);
    await userEvent.type(screen.getByLabelText('stable-Ann'), 'ann-note');
    await userEvent.type(screen.getByLabelText('index-Ann'), 'ann-note');
    for (const b of screen.getAllByRole('button', { name: 'Reverse order' })) await userEvent.click(b);
    expect(screen.getByLabelText('stable-Ann')).toHaveValue('ann-note'); // followed Ann
    expect(screen.getByLabelText('index-Ann')).toHaveValue(''); // stayed in position 0 → now Cy's slot
    expect(screen.getByLabelText('index-Cy')).toHaveValue('ann-note'); // the classic bug
  });
  it('memo + useCallback row keeps its render count; the inline-callback row re-renders', async () => {
    render(<RenderingDemo />);
    const stable = () => screen.getByRole('button', { name: /^stable ·/ }).textContent;
    const inline = () => screen.getByRole('button', { name: /^inline ·/ }).textContent;
    const [s0, i0] = [stable(), inline()];
    await userEvent.click(screen.getByRole('button', { name: /Re-render parent/ }));
    expect(stable()).toBe(s0);
    expect(inline()).not.toBe(i0);
  });
  it('portal tooltip is rendered in <body>, outside the clipped parent', async () => {
    render(<RenderingDemo />);
    await userEvent.hover(screen.getByText('Hover me'));
    const tip = await screen.findByRole('tooltip');
    expect(tip.parentElement).toBe(document.body);
  });
  it('error boundary catches the render error and recovers', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<RenderingDemo />);
    await userEvent.click(screen.getByRole('button', { name: 'Throw during render' }));
    expect(await screen.findByText(/Boom: a render-time error/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recover' }));
    expect(await screen.findByText('Safe ✔')).toBeInTheDocument();
    spy.mockRestore();
  });
});
