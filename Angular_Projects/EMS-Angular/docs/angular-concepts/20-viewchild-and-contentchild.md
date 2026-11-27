# 20 · `ViewChild`, `ViewChildren`, `ContentChild`, `ContentChildren`

## 1. Concept explanation
Queries give a component references to things in **its own template** (`viewChild`/`viewChildren`) or in **content projected into it** (`contentChild`/`contentChildren`). Modern signal queries return signals; the decorator forms (`@ViewChild`, `@ContentChildren`) still exist.

## 2. Angular API / syntax
```ts
private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');   // template ref
private readonly inputs = viewChildren(MatInput);                                       // all instances
readonly dayTemplate = contentChild<TemplateRef<CalendarDayContext>>(TemplateRef);      // projected template
@ContentChildren(CellDirective) private cells!: QueryList<CellDirective>;               // decorator form
```

## 3. Where each is used
| Query | Use | File |
|---|---|---|
| `viewChild.required` (template ref) | reset the native `<input type=file>` after a selection so the same file can be picked again | `shared/components/file-upload.component.ts` |
| `viewChild.required` (component) | drive `MatSidenav` open/close from preference/handset state | `layout/shell.component.ts` |
| **`viewChildren`** | after an invalid submit, find the first rendered `MatInput` whose control is invalid and focus it | `features/employees/employee-form.component.ts` |
| **`contentChild`** | the day template projected into the month grid (`<ng-template let-day>` rendered with `ngTemplateOutlet`) | `shared/components/month-calendar.component.ts` |
| **`@ContentChildren`** | collect `<ng-template appCell="…">` column templates, rebuilding on `QueryList.changes`, in `ngAfterContentInit` | `shared/components/data-table.component.ts` |
| Template reference variables | `#picker`, `#f="ngForm"`, `#auto="matAutocomplete"`, `#rla="routerLinkActive"` | file upload, settings form, employee select, shell |

## 4. Relevant file paths
`src/app/shared/components/{file-upload,data-table,month-calendar}.component.ts`, `src/app/features/employees/employee-form.component.ts`, `src/app/layout/shell.component.ts`.

## 5. Practical implementation explanation
* **Content queries are about *who the parent is*.** `DataTableComponent` doesn't know which columns have custom cells; the page passes `<ng-template appCell="status" let-e>…</ng-template>` and the table discovers them with `@ContentChildren(CellDirective)` (available after `ngAfterContentInit`), storing them in a `signal<Map<string, TemplateRef>>` so the template reads them reactively.
* **View queries are about *own template*.** `FileUploadComponent` needs the real `<input>` element to clear it; `viewChild.required('picker')` throws if the element is missing (compile-time-ish safety instead of `!`).
* **`viewChildren` for UX.** The employee form focuses the first invalid input: `this.inputs().find(i => i.ngControl?.invalid)?.focus()` — a real accessibility improvement with no manual element bookkeeping.
* **Static vs dynamic.** Queries inside `@if/@for` blocks are dynamic and update automatically (signal queries make that explicit).

## 6. Why this concept was selected
Generic components (table, calendar) must accept caller-provided markup; queries are how they find it. View queries solve the few places that need imperative DOM/component access.

## 7. Interview-related considerations
* *ViewChild vs ContentChild?* View = declared in the component's own template; Content = projected between the component's tags by the parent.
* *When are they available?* View queries after `ngAfterViewInit` (signal queries: whenever read after render); content queries after `ngAfterContentInit`.
* *`static: true`?* Only for decorator queries not inside structural blocks — resolves before first CD (`ngOnInit`).
* *Signal queries vs decorators:* signal queries are readonly signals, work with `computed/effect`, and don't need lifecycle hooks.
* *Avoid querying to mutate child state* — prefer inputs/outputs; queries are for read-only discovery or imperative DOM calls (focus, scroll).
