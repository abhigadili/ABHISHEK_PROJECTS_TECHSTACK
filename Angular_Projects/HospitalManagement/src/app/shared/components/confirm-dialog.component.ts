import { ChangeDetectionStrategy, Component, Injectable, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, map } from 'rxjs';
import { LoggingService } from '../../core/services/logging.service';

export interface ConfirmData { title: string; message: string; confirmLabel?: string; destructive?: boolean; askReason?: boolean; reasonLabel?: string }
export interface ConfirmResult { confirmed: boolean; reason?: string }

/** Modal lifecycle demo: ngOnInit / ngOnDestroy are logged so the dialog's lifetime is visible (see LifecycleLogService). */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.askReason) {
        <mat-form-field class="w-full"><mat-label>{{ data.reasonLabel ?? 'Reason (optional)' }}</mat-label><input matInput [(ngModel)]="reason" maxlength="255" /></mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="{ confirmed: false }">Keep it</button>
      <button mat-flat-button [color]="data.destructive ? 'warn' : 'primary'" [mat-dialog-close]="{ confirmed: true, reason: reason || undefined }">{{ data.confirmLabel ?? 'Confirm' }}</button>
    </mat-dialog-actions>`,
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
  private readonly log = inject(LoggingService);
  protected reason = '';
  protected readonly opened = signal(false);
  ngOnInit() { this.opened.set(true); this.log.debug('ConfirmDialog opened'); }
  ngOnDestroy() { this.log.debug('ConfirmDialog destroyed – subscriptions/listeners cleaned up'); }
}

/** Service → component communication: `confirm$` returns an Observable of the user's answer (component-to-service-to-component). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);
  confirm(data: ConfirmData): Observable<ConfirmResult> {
    return this.dialog.open<ConfirmDialogComponent, ConfirmData, ConfirmResult>(ConfirmDialogComponent, { data, width: '420px' }).afterClosed().pipe(map((r) => r ?? { confirmed: false }));
  }
}
