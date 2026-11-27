import { Injectable, signal } from '@angular/core';

export interface LifecycleEntry { readonly at: number; readonly component: string; readonly hook: string; readonly detail?: string }

/** Collects lifecycle hook calls (shown by the appointment summary "inspector"). Capped list so ngDoCheck/ngAfterViewChecked cannot flood memory. */
@Injectable({ providedIn: 'root' })
export class LifecycleLogService {
  private readonly _entries = signal<readonly LifecycleEntry[]>([]);
  readonly entries = this._entries.asReadonly();
  private readonly counts = new Map<string, number>();
  log(component: string, hook: string, detail?: string): void {
    const key = `${component}.${hook}`;
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    // "checked" hooks fire on every change-detection pass: only the first call and every 25th are recorded
    if (n > 1 && (hook === 'ngDoCheck' || hook.endsWith('Checked')) && n % 25 !== 0) return;
    this._entries.update((l) => [...l.slice(-39), { at: Date.now(), component, hook, detail: detail ?? (n > 1 ? `call #${n}` : undefined) }]);
  }
  counter(component: string, hook: string): number { return this.counts.get(`${component}.${hook}`) ?? 0; }
  clear(): void { this._entries.set([]); this.counts.clear(); }
}
