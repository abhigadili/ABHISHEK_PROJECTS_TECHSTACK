# 16 · Custom pipes

## 1. Concept explanation
A custom pipe is a small, **pure**, stateless class implementing `PipeTransform` — ideal for presentation formatting of domain values (enums, names, durations). Heavy logic or business rules do not belong in a pipe.

## 2. Angular API / syntax
```ts
@Pipe({ name: 'workingHours' })
export class WorkingHoursPipe implements PipeTransform {
  transform(hours: number | null | undefined): string {
    if (hours === null || hours === undefined || isNaN(hours)) return '—';
    const m = Math.round(hours * 60);
    return `${Math.floor(m / 60)}h ${`${m % 60}`.padStart(2, '0')}m`;
  }
}
```

## 3. Where implemented and used — `src/app/shared/pipes/pipes.ts`
| Pipe | Transforms | Used in |
|---|---|---|
| `employeeStatus` | `ACTIVE → "Active"` | employee list/details, department employees, users list |
| `employmentType` | `FULL_TIME → "Full Time"` | employee list filter, details header, employee form select, overview |
| `leaveStatus` | `PENDING → "Awaiting approval"`, `APPROVED → "Approved"` … (unknown → title case) | leave home/admin tables, filters, leave detail |
| `employeeName` | `{firstName,lastName}` → full / `"Last, First"` / initials | employee details header |
| `workingHours` | `7.5 → "7h 30m"`, `null → "—"` | attendance card, history, details |
| `serverDateTime` | backend UTC timestamps (`"2026-11-04 08:11:46"` or ISO) → local date/time/date-time | attendance, leave detail, notifications menu/page |

Tests: `shared/pipes/pipes.spec.ts` — null handling, rounding, fallback labels, and that MySQL-style timestamps are treated as **UTC** (08:11 UTC renders as the browser's local time).

## 4. Relevant file paths
`src/app/shared/pipes/pipes.ts`, `src/app/shared/utils/dates.ts` (`parseServerDateTime`).

## 5. Practical implementation explanation
* **Single place for domain labels.** Enum → label mapping used to be scattered `replace('_',' ')` calls; the pipes give consistent wording (`Awaiting approval`) in tables, badges and filters.
* **Server time is UTC without a zone marker** (`YYYY-MM-DD HH:mm:ss`); `serverDateTime` appends `Z` before constructing the `Date`, otherwise the browser would treat it as local time and show the wrong hour — a classic bug, covered by a test.
* **Pure by design** — safe with OnPush and cheap; no HTTP, no services, no `Date.now()` dependence (so output is deterministic and testable).
* **Not pipes:** the “working-hours total” and “days between” numbers are `computed()` signals or backend values — pipes only format.

## 6. Why this concept was selected
The backend returns raw enums and UTC strings; formatting them in one tested place keeps screens consistent and avoids per-component date bugs.

## 7. Interview-related considerations
* *When write a custom pipe vs a component method?* Pure formatting reused across templates → pipe; interaction or heavy work → component/service.
* *Why pure?* Angular calls pure pipes only when the input identity changes; impure pipes run on every CD pass.
* *Testing a pipe:* instantiate with `new` — no `TestBed` needed (see the spec).
* *Locale-sensitive pipes* (e.g. `serverDateTime`) use `toLocaleString(undefined, …)` so they follow the browser locale.
* *Don't mutate the input inside a pipe* — breaks purity assumptions.
