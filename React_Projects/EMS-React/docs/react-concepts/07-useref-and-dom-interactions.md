# 07 · `useRef` and direct DOM interaction

## 1. Concept explanation
`useRef` returns a stable object `{ current }` that **survives re-renders without causing one**. It has two jobs:
1. **A handle to a DOM node** (`<input ref={r}>` → `r.current` is the element) for things React state can't express: focus, scroll, measuring, calling `click()`, media playback.
2. **A mutable box** for values that are not part of the UI output: an `AbortController`, a timer id, a sequence number, "has this already run?" flags.

Rule: refs are an **escape hatch**. If the UI should change when a value changes, it is *state*, not a ref. Never read/write
`ref.current` during render (except harmless diagnostics) — do it in handlers/effects.

React 19 note: `ref` is now an ordinary prop for function components, but `forwardRef` still works and is used here to
demonstrate ref forwarding and `useImperativeHandle`.

## 2. Syntax
```tsx
const inputRef = useRef<HTMLInputElement>(null);
<input ref={inputRef} />;   inputRef.current?.focus();

const Child = forwardRef<Handle, Props>(function Child(props, ref) {
  useImperativeHandle(ref, () => ({ focus: () => inner.current?.focus(), clear: () => { … } }), []);
  …
});
const handle = useRef<Handle>(null);  <Child ref={handle} />;  handle.current?.clear();
```

## 3. Actual EMS implementation
| Technique | Where |
|---|---|
| DOM element reference + file input handling | `components/common/FileUpload.tsx` — hidden `<input type="file">` clicked programmatically; value reset after upload so the same file can be picked twice |
| **`forwardRef` + imperative handle** | `FileUpload` exposes `{ open(), clear() }` through `useImperativeHandle`; the parent can't touch the raw `<input>` |
| Using the handle | `features/profile/PictureManager.tsx` (`uploadRef.current?.clear()` after an upload), `features/leaves/LeaveApplyPage.tsx` |
| Mutable value that must not re-render | `hooks/useApi.ts` (`controller` ref = current `AbortController`, `seq` ref = latest request id, `fnRef` = latest callback); `EmployeeFormPage.tsx` (`done` ref for the unsaved-changes blocker) |
| **Focus management** | `features/lab/BasicHooksDemo.tsx` / `AdvancedHooksDemo.tsx` (`focus()` button); `ConfirmDialog` uses MUI's `autoFocus` on the primary action |
| **Scroll management** | `features/organization/OrgTree.tsx` (`scrollIntoView` for the selected node, in `useLayoutEffect`); `EmployeeFormPage.tsx` (scroll the stepper into view after "Next") |
| Uncontrolled form via ref | `features/lab/FormsDemo.tsx` (`UncontrolledForm` reads `ref.current.value` only on submit) |
| Layout measurement | `AdvancedHooksDemo.tsx` `MeasuredBox` (`getBoundingClientRect` + `ResizeObserver`) |
| Render counters in demos | `RenderingDemo.tsx` (`useRef(0)` incremented each render to *prove* memoisation) |

## 4. Relevant file paths
`src/components/common/FileUpload.tsx`, `src/hooks/useApi.ts`, `src/features/organization/OrgTree.tsx`,
`src/features/profile/PictureManager.tsx`, `src/features/lab/BasicHooksDemo.tsx`.

## 5. Practical implementation
The race-safe request hook is mostly refs (`hooks/useApi.ts`):
```ts
const controller = useRef<AbortController | null>(null);
const seq = useRef(0);
const run = useCallback(async (...a: A) => {
  controller.current?.abort();                    // cancel the previous request
  const ctrl = new AbortController(); controller.current = ctrl;
  const id = ++seq.current;                       // identify THIS request
  …
  if (id === seq.current) { setData(result); }    // only the latest response may write state
}, []);
```
Why refs and not state? Changing `seq` must not re-render, and `run` must always see the *current* value.

## 6. Why the concept is used
Some things are inherently imperative (focus a field, open the OS file picker, scroll an element, cancel a network call). Refs let
imperative code coexist with declarative rendering without fighting it.

## 7. Advantages and limitations
**+** No re-render cost; direct DOM access when truly needed; stable identity across renders. **−** Easy to abuse as hidden state
(untracked by React, invisible to DevTools); imperative handles weaken encapsulation if they expose too much (so `FileUpload`
exposes two methods, tested to be exactly `['clear','open']`); refs are `null` before mount/after unmount — always use `?.`.

## 8. Interview-related considerations
* `useRef` vs `useState` vs a module variable. Why doesn't mutating `ref.current` re-render?
* Callback refs vs object refs; ref cleanup (React 19 allows a cleanup function from a callback ref).
* `forwardRef` (React ≤18 necessity) vs ref-as-prop (React 19); what `useImperativeHandle` is for and why to expose a *narrow* API.
* Controlled vs uncontrolled inputs (doc 10). Accessing the DOM in `useEffect` vs `useLayoutEffect`.
* How would you focus the first invalid field after a failed submit? (RHF `shouldFocusError` or a ref + effect).
