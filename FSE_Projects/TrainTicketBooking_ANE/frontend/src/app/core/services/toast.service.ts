import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly bar = inject(MatSnackBar);
  success(m: string) { this.bar.open(m, 'OK', { duration: 4000, panelClass: 'toast-success' }); }
  error(m: string) { this.bar.open(m, 'Dismiss', { duration: 7000, panelClass: 'toast-error' }); }
  info(m: string) { this.bar.open(m, 'OK', { duration: 4000 }); }
}
