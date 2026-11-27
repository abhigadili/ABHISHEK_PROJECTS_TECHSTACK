import { Injectable, computed, signal } from '@angular/core';

/** Counts in-flight requests (driven by the loading interceptor). `isLoading` is a derived signal, not duplicate state. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  readonly isLoading = computed(() => this.pending() > 0);

  begin(): void {
    this.pending.update((n) => n + 1);
  }

  end(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }
}
