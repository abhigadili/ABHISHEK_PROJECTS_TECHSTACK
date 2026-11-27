import { Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { UI } from '../material';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-confirm', imports: [UI, FormsModule],
  template: `<h2 mat-dialog-title>{{ d.title }}</h2>
    <mat-dialog-content><p>{{ d.message }}</p>
      @if (d.reasonLabel) { <mat-form-field><mat-label>{{ d.reasonLabel }}</mat-label><input matInput [(ngModel)]="reason"></mat-form-field> }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [color]="d.danger ? 'warn' : 'primary'" [mat-dialog-close]="{ ok: true, reason }">{{ d.confirmText ?? 'Confirm' }}</button></mat-dialog-actions>`
})
export class ConfirmDialog {
  d = inject<{ title: string; message: string; confirmText?: string; danger?: boolean; reasonLabel?: string }>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<ConfirmDialog>);
  reason = '';
}

@Injectable({ providedIn: 'root' })
export class Dialogs {
  private dialog = inject(MatDialog);
  /** @returns an observable emitting { reason } only if the user confirmed */
  confirm(title: string, message: string, opts: { confirmText?: string; danger?: boolean; reasonLabel?: string } = {}): Observable<{ reason: string } | null> {
    return this.dialog.open(ConfirmDialog, { data: { title, message, ...opts }, width: '420px' }).afterClosed().pipe(map(r => (r?.ok ? { reason: r.reason as string } : null)));
  }
}
