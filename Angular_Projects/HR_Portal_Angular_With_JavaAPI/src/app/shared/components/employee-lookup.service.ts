import { Injectable, inject, signal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../api/client/api-client.service';
import { opKey } from '../../api/queries/op-query';
import type { EmployeeSummary } from '../../api/types/employee';

/**
 * Bulk id -> employee summary resolution through POST /employees/lookup. Ids requested in the same tick are batched into ONE call.
 * One unreadable record makes the bulk call fail (HTTP 5xx) - then per-id summaries are used so the readable ones still resolve.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeLookupService {
  private readonly api = inject(ApiClient);
  private readonly qc = inject(QueryClient);
  readonly map = signal<ReadonlyMap<string, EmployeeSummary>>(new Map());
  private requested = new Set<string>(); private queue = new Set<string>(); private timer: any;

  request(id?: string | null) {
    if (!id || this.requested.has(id)) return;
    this.requested.add(id); this.queue.add(id);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 25);
  }
  get(id?: string | null): EmployeeSummary | undefined { return id ? this.map().get(id) : undefined; }
  private put(list: EmployeeSummary[]) { const m = new Map(this.map()); list.forEach((e) => e.id && m.set(e.id, e)); this.map.set(m); }
  private async flush() {
    const ids = [...this.queue].sort(); this.queue.clear();
    if (!ids.length) return;
    try {
      const list = await this.qc.fetchQuery({ queryKey: opKey('employee.lookup', { query: { ids } }), staleTime: 5 * 60_000, queryFn: () => firstValueFrom(this.api.call<EmployeeSummary[]>('employee.lookup', { body: { ids } })) });
      this.put(list);
    } catch (e: any) {
      if (e?.network) { ids.forEach((i) => this.requested.delete(i)); return; }
      const r = await Promise.allSettled(ids.slice(0, 40).map((id) => this.qc.fetchQuery({ queryKey: opKey('employee.summary', { path: { id } }), staleTime: 5 * 60_000, queryFn: () => firstValueFrom(this.api.call<EmployeeSummary>('employee.summary', { path: { id } })) })));
      this.put(r.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : [])));
    }
  }
}
