# 15 · Angular pipes (built-in)

## 1. Concept explanation
A pipe transforms a value inside a template (`{{ value | pipeName: arg }}`). **Pure** pipes (default) re-run only when their input reference changes — cheap. `AsyncPipe` subscribes to an Observable/Promise and unwraps it, unsubscribing automatically.

## 2. Angular API / syntax
```html
{{ emp.joiningDate | date: 'longDate' }}   {{ c.salary | currency: c.salaryCurrency || 'USD' }}
{{ emp.workEmail | lowercase }}            {{ emp.status | i18nSelect: statusText }}
@for (t of types$ | async; track t.id) { … }
```

## 3. Where each predefined pipe is used on a real screen
| Pipe | Use | File |
|---|---|---|
| `DatePipe` | joining date, attendance days, leave periods, dashboard events | `employee-tabs.component.ts`, `attendance.component.ts`, `leave-home.component.ts`, `dashboard-widgets.ts` |
| `CurrencyPipe` | salary & bonus target in the employee overview (HR only), currency from the record | `employee-tabs.component.ts` |
| `DecimalPipe` | leave balances `number: '1.0-1'`, monthly salary | `leave-home.component.ts`, `dashboard-widgets.ts` |
| `PercentPipe` | accessible label of the used-balance progress bar | `dashboard-widgets.ts` (`BalancesWidgetComponent`) |
| `UpperCasePipe` | employee code | `employee-tabs.component.ts` |
| `LowerCasePipe` | work e-mail | `employee-tabs.component.ts` |
| `TitleCasePipe` | work location, attendance status labels | `employee-tabs.component.ts`, `attendance.component.ts` |
| `JsonPipe` | arbitrary JSON `details` in the audit log | `reports/reports.component.ts` (`AuditLogComponent`) |
| `KeyValuePipe` | iterate the `byStatus` map of the attendance summary | `attendance.component.ts` |
| `SlicePipe` | trim “last updated” timestamp and long job-history notes | `employee-tabs.component.ts` |
| `AsyncPipe` | leave types in the apply form (`types$ | async`) | `leave-apply.component.ts` |
| `I18nSelectPipe` | map status enum → sentence (`ACTIVE → Currently employed`) | `employee-tabs.component.ts` |

(Not used as pipes on purpose: heavy computations — those are `computed()` signals or backend work.)

## 4. Relevant file paths
`src/app/features/employees/employee-tabs.component.ts` (the pipe showcase), `src/app/features/attendance/attendance.component.ts`, `src/app/features/leaves/leave-home.component.ts`, `src/app/features/reports/reports.component.ts`.

## 5. Practical implementation explanation
* Pipes receive **already-loaded** data; they never fetch. `CurrencyPipe` takes the ISO code stored with the salary so a EUR salary isn't rendered as USD.
* `KeyValuePipe` over `{ PRESENT: 12, HALF_DAY: 1 }` produces the status chips; its default ordering is by key, which is stable.
* `AsyncPipe` is used where a one-shot, component-lifetime stream is rendered directly (leave types) — no manual subscribe/unsubscribe. Elsewhere `toSignal` replaces it.
* Locale: pipes format via the active locale (`LOCALE_ID`); nothing in templates hard-codes a date/number format string besides the pipe's own options — see “i18n readiness” in 24.

## 6. Why this concept was selected
Formatting belongs in the view layer; built-in pipes are tested, locale-aware and memoised.

## 7. Interview-related considerations
* *Pure vs impure pipes:* impure pipes (`pure: false`, and `async`) run every CD cycle — avoid expensive logic there.
* *Pipe vs method call in template:* a pure pipe is cached per input; a method runs every CD (fine only if trivial or backed by signals).
* *Pipe precedence:* `a ? b : c | pipe` binds the pipe to `c` — wrap in parentheses.
* *`AsyncPipe` vs `toSignal`:* both unsubscribe automatically; `toSignal` gives a signal usable in `computed`/TS code.
* *`json` pipe is for debugging/arbitrary payloads, not for end-user output* — used for the audit-log details cell where the shape is arbitrary.
