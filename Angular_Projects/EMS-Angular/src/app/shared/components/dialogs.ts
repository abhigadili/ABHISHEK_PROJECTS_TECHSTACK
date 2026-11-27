import { ChangeDetectionStrategy, Component, Injectable, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, filter, map } from 'rxjs';
import { AutofocusDirective } from '../directives/directives';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button type="button" [color]="data.danger ? 'warn' : 'primary'" [mat-dialog-close]="true" data-testid="confirm-yes">
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

export interface ReasonData {
  title: string;
  message?: string;
  label?: string;
  required?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  minLength?: number;
}

/** Collects a free-text reason/note (reject leave, cancel request, deactivate employee…). */
@Component({
  selector: 'app-reason-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.message) {
        <p>{{ data.message }}</p>
      }
      <mat-form-field appearance="outline" class="full">
        <mat-label>{{ data.label ?? 'Reason' }}</mat-label>
        <textarea matInput appAutofocus rows="3" [formControl]="reason" maxlength="500" data-testid="reason-input"></textarea>
        <mat-error>Please enter at least {{ data.minLength ?? 3 }} characters</mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close()">Cancel</button>
      <button mat-flat-button type="button" [color]="data.danger ? 'warn' : 'primary'" [disabled]="reason.invalid" (click)="ref.close(reason.value.trim())" data-testid="reason-confirm">
        {{ data.confirmLabel ?? 'Submit' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `.full { width: 100%; min-width: min(420px, 80vw); }`,
})
export class ReasonDialogComponent {
  protected readonly data = inject<ReasonData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ReasonDialogComponent, string>>(MatDialogRef);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: this.data.required === false ? [] : [Validators.required, Validators.minLength(this.data.minLength ?? 3)],
  });
}

/** Reusable dialog chrome: title, scrollable body (projected) and an actions slot (projected). */
@Component({
  selector: 'app-dialog-frame',
  standalone: true,
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>
    <mat-dialog-content><ng-content /></mat-dialog-content>
    <mat-dialog-actions align="end"><ng-content select="[dialogActions]" /></mat-dialog-actions>
  `,
})
export class DialogFrameComponent {
  readonly title = input.required<string>();
}

/** Promise-free helpers so features ask a question in one line: `dialogs.confirm({...}).subscribe(...)`. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(MatDialog);

  /** Emits once, only when the user confirms. */
  confirm(data: ConfirmData): Observable<true> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmData, boolean>(ConfirmDialogComponent, { data, width: '420px', maxWidth: '95vw' })
      .afterClosed()
      .pipe(filter((ok): ok is true => ok === true));
  }

  /** Emits the trimmed reason, only when the user submits. */
  askReason(data: ReasonData): Observable<string> {
    return this.dialog
      .open<ReasonDialogComponent, ReasonData, string>(ReasonDialogComponent, { data, maxWidth: '95vw' })
      .afterClosed()
      .pipe(filter((v): v is string => typeof v === 'string'), map((v) => v));
  }
}
