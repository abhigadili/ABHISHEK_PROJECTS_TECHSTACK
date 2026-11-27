import { Injectable, computed, signal } from '@angular/core';

/** Utility service: global loading state (Signal-based communication between the loading interceptor and the layout progress bar). */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  readonly isLoading = computed(() => this.pending() > 0);
  begin() { this.pending.update((n) => n + 1); }
  end() { this.pending.update((n) => Math.max(0, n - 1)); }
}
