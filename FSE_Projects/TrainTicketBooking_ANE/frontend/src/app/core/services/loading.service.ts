import { Injectable, computed, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  readonly busy = computed(() => this.pending() > 0);
  start() { this.pending.update((n) => n + 1); }
  stop() { this.pending.update((n) => Math.max(0, n - 1)); }
}
