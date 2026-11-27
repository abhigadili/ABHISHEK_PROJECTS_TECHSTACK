# 25 · Portals and Fragments

## 1. Concept explanation
**Fragments** let a component return several siblings **without adding a wrapper DOM node** — important inside tables, flex/grid
containers and lists where an extra `<div>` would break layout or semantics.

**Portals** (`createPortal(children, domNode)`) render a child into a **different DOM node** (usually `document.body`) while keeping it
in the **same React tree**: context, state and **event bubbling** still follow the React hierarchy, but the element escapes ancestors'
`overflow: hidden`, `transform`, and `z-index` stacking contexts. They are the right tool for modals, toasts, tooltips and menus.

## 2. Syntax
```tsx
<>…</>                                           // shorthand
<Fragment key={section}>…</Fragment>             // long form — the only one that accepts a key
return createPortal(<div role="status">…</div>, document.body);
```

## 3. Actual EMS implementation
| Item | Where |
|---|---|
| `React.Fragment` (long form with `key`) | `components/layout/Sidebar.tsx` — one fragment per nav section (divider + subheader + items) |
| **Fragment shorthand** | `EmployeeListPage`, `DepartmentDetailPage`, `AttendancePage`, `NotificationMenu` (`<> <IconButton/> <Popover/> </>`), `LeaveAdminPage`, `ConfirmProvider`, `Can` (`<>{allowed ? children : fallback}</>`) |
| **`createPortal` — toast notifications** | `components/dialogs/ToastHost.tsx` renders the whole toast stack into `document.body` (fixed bottom-right, `aria-live="polite"`), so no page layout can clip or cover it |
| **`createPortal` — tooltip / overlay** | `features/lab/RenderingDemo.tsx#PortalTip` — a tooltip inside a parent with `overflow: hidden; height: 28px` still shows in full because it is portalled to `<body>` and positioned from `getBoundingClientRect()` |
| **Modal rendering** | `components/dialogs/Modal.tsx` — MUI `Dialog` (internally a portal into `<body>`) used by designation, holiday, user, job-change, leave-type, balance-adjust, attendance-correction, approval dialogs |
| **Confirmation dialog rendering** | `components/dialogs/ConfirmDialog.tsx` — one provider-hosted dialog for the whole app (`useConfirm()`); also portalled through MUI |
| Menus / popovers | `NotificationMenu` (`Popover`), `UserMenu` (`Menu`) — MUI portals |
| Accessibility around portals | dialogs use `aria-labelledby`, focus is trapped/restored by MUI; toasts are a polite live region; the toast host has `role="status"` |

## 4. Relevant file paths
`src/components/dialogs/ToastHost.tsx`, `src/components/dialogs/Modal.tsx`, `src/components/dialogs/ConfirmDialog.tsx`,
`src/components/layout/Sidebar.tsx`, `src/features/lab/RenderingDemo.tsx`, tests in `src/contexts/contexts.test.tsx` and `src/features/lab/lab.test.tsx`.

## 5. Practical implementation
```tsx
// ToastHost.tsx
export function ToastHost() {
  const toasts = useToasts();
  return createPortal(
    <Box role="status" aria-live="polite" sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: (t) => t.zIndex.snackbar, display: 'grid', gap: 1 }}>
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </Box>, document.body);
}
```
Tests assert the **DOM parent**: the toast container's `parentElement` is `document.body` (`contexts.test.tsx`) and the portalled tooltip's parent is `body`
(`lab.test.tsx`). Because React-tree semantics are preserved, `ToastHost` still reads the Notification Context from where it is *rendered*, not where it
appears in the DOM.

## 6. Why the concept is used
Overlays must be visually on top and unclipped regardless of where in the tree they are triggered (inside a table cell, a clipped card, a scrolling pane).
Fragments keep the DOM semantic (`<tr><td>` structures, flex rows) without junk wrappers.

## 7. Advantages and limitations
**+** immune to ancestor clipping/stacking issues; React events/context still work; no wrapper-div pollution. **−** CSS inherited from the portal's *DOM* parent (not the React parent) — theme variables must come from Context/a theme provider (MUI handles this); focus management/aria must be done manually for custom portals (use MUI Dialog for modals); portals need a mount node and `document` (client-only); a Fragment can't take props other than `key`.

## 8. Interview-related considerations
* Why use a portal for a modal? Do events bubble through a portal to the React parent? (Yes.)
* Fragment vs `div`; when do you need `<Fragment key>`? Why does an extra wrapper break `<table>` markup?
* Accessibility of modals: focus trap, `aria-modal`, Escape, restoring focus, scroll lock.
* z-index/stacking contexts and why `position: fixed` inside a `transform`ed ancestor misbehaves.
