import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { NotificationChannel } from '../configuration/app-config';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export interface Toast { readonly kind: ToastKind; readonly message: string; readonly at: number }

/**
 * Toast notification service (Angular Material snackbars). Implements the abstract NotificationChannel token,
 * so features can inject the abstraction. `toasts$` is a Subject that other parts (e.g. the activity log) subscribe to.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService extends NotificationChannel {
  private readonly snack = inject(MatSnackBar);
  private readonly stream = new Subject<Toast>();
  readonly toasts$ = this.stream.asObservable();
  private readonly lastByKey = new Map<string, number>();

  push(kind: ToastKind, message: string, dedupeKey?: string): void {
    if (dedupeKey) {
      const now = Date.now();
      if (now - (this.lastByKey.get(dedupeKey) ?? 0) < 4000) return; // avoid toast storms (e.g. several failing requests at once)
      this.lastByKey.set(dedupeKey, now);
    }
    this.stream.next({ kind, message, at: Date.now() });
    this.snack.open(message, 'Dismiss', { duration: kind === 'error' ? 6000 : 3500, panelClass: [`hms-toast-${kind}`], horizontalPosition: 'right', verticalPosition: 'top' });
  }
  success(m: string) { this.push('success', m); }
  error(m: string, dedupeKey?: string) { this.push('error', m, dedupeKey); }
  info(m: string) { this.push('info', m); }
  warning(m: string) { this.push('warning', m); }
}
