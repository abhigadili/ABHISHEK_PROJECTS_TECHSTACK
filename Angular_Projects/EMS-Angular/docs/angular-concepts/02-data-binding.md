# 02 · Data binding

## 1. Concept explanation
Data binding connects component state to the DOM. Angular has four directions: **interpolation/property binding** (class → view), **event binding** (view → class), and **two-way binding** (both). Specialised bindings target attributes, classes and styles.

## 2. Angular API / syntax
| Kind | Syntax |
|---|---|
| Interpolation | `{{ employee().fullName }}` |
| Property | `[disabled]="saving()"`, `[value]="status()"` |
| Attribute | `[attr.aria-label]="'Remove skill ' + (i + 1)"`, `[attr.data-testid]="…"` |
| Class / style | `[class.selected]="selectedId() === node().id"`, `[style.width.px]="size()"`, `[ngClass]`, `[ngStyle]` |
| Event | `(click)="open($event)"`, `(keydown.enter)="…"`, `(ngSubmit)="submit()"` |
| Two-way | `[(value)]="text"` (model input), `[(ngModel)]="model.pageSize"` |

## 3. Where it is implemented in EMS
| Binding | Example (file → place) |
|---|---|
| Interpolation + pipes | `employee-tabs.component.ts` (overview), `leave-home.component.ts` |
| Property binding | `data-table.component.ts` (`[dataSource]`, `[length]`, `[pageIndex]`), `profile-picture.component.ts` (`[src]`, `[style.width.px]`) |
| Attribute binding | `data-table` (`[attr.tabindex]`), `org-node.component.ts` (`[attr.aria-expanded]`, `[attr.aria-selected]`), every `[attr.data-testid]` used by Playwright |
| Class binding | `org-node.component.ts` (`[class.selected]`, `[class.on-path]`), `employee-form.component.html` |
| Style binding | `profile-picture` (`[style.width.px]`, `[style.fontSize.px]`), `calendar-page.component.ts` (`[style.background]`) |
| `[ngClass]` / `[ngStyle]` | `password-strength.component.ts`, `notifications.component.ts` (`[ngClass]="{ unread: !n.isRead }"`) |
| Event binding | `login.component.ts` (`(ngSubmit)="submit$.next()"`), `employee-list.component.ts` (`(selectionChange)`, `(searchChange)`) |
| Two-way (model) | `search-box.component.ts` (`value = model('')`) used as `[(value)]` in `search-box.component.spec.ts`; `[(ngModel)]` in `profile/settings.component.ts` |
| Template reference variables | `settings.component.ts` (`#f="ngForm"`, `#displayName="ngModel"`), `file-upload.component.ts` (`#picker`) |

## 4. Relevant file paths
`src/app/shared/components/search-box.component.ts`, `src/app/features/profile/settings.component.ts`, `src/app/features/organization/org-node.component.ts`, `src/app/shared/components/password-strength.component.ts`.

## 5. Practical implementation explanation
* **Two-way with `model()`.** `SearchBoxComponent.value = model('')`: the parent writes `[(value)]="text"`; inside the component an `effect` pushes parent changes into the `FormControl` (with `emitEvent:false` so the parent's own value isn't echoed as a user search) and a debounced `valueChanges` pipeline writes back with `value.set(...)`.
* **Attribute vs property.** ARIA attributes have no DOM property, so they use `[attr.…]`; the org tree sets `aria-expanded` to `null` for leaf nodes so the attribute disappears entirely.
* **Style units.** `[style.width.px]="size()"` appends the unit; avatar font size is derived from the same signal (`size() * 0.4`).
* **Why `$event` is typed.** Material emits typed events: `(selectionChange)="patch({ departmentId: $event.value })"`.
* **Event filtering.** `(keydown.enter)` is a key-event pseudo-event; `employee-card` supports keyboard activation this way (accessibility).

## 6. Why this concept was selected
Binding is the core of the template language; the app uses the *specific* binding for each job (ARIA attributes, units, classes) instead of string-concatenating HTML, which also keeps templates XSS-safe — Angular sanitises bound values (no `innerHTML` is used anywhere).

## 7. Interview-related considerations
* *Property vs attribute binding?* Properties are DOM object fields; attributes are HTML. Use `[attr.x]` when there is no property (ARIA, `data-*`, `colspan`).
* *How does `[(x)]` work?* Sugar for `[x]="v" (xChange)="v=$event"`; with `model()` the `xChange` output is generated for you.
* *Why prefer `[class.x]` over `[ngClass]`?* Single class toggles are cheaper and typed; `ngClass` is for maps/arrays (kept in `password-strength` as the documented legacy example).
* *Is `{{ }}` safe?* Yes: Angular escapes interpolated text; only `[innerHTML]` goes through the sanitiser (unused here).
* *Function calls in templates?* Fine with signals (`computed`) or cheap functions; avoid heavy work (the app uses `computed` for derived view-models).
