import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Thin wrapper over Angular Material's snack bar so every toast looks and behaves the same. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snack = inject(MatSnackBar);
  private lastMessage = '';
  private lastAt = 0;

  success(message: string): void {
    this.open(message, 'toast-success', 3500);
  }

  error(message: string): void {
    // Avoid stacking the same error twice within 2s (e.g. several parallel requests failing together).
    const now = Date.now();
    if (message === this.lastMessage && now - this.lastAt < 2000) return;
    this.lastMessage = message;
    this.lastAt = now;
    this.open(message, 'toast-error', 6000);
  }

  info(message: string): void {
    this.open(message, 'toast-info', 3500);
  }

  private open(message: string, panelClass: string, duration: number): void {
    this.snack.open(message, 'Dismiss', { duration, panelClass, horizontalPosition: 'end', verticalPosition: 'bottom' });
  }
}
