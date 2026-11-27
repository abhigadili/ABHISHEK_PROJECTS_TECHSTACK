import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusLabelPipe } from '../pipes/pipes';
import { LoadingService } from '../../core/services/loading.service';
import { Injectable } from '@angular/core';
import { firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/** Content projection: title + subtitle inputs, projected action buttons on the right (`<ng-content>`). */
@Component({
  selector: 'app-page-header', changeDetection: ChangeDetectionStrategy.OnPush, encapsulation: ViewEncapsulation.Emulated,
  template: `<header class="ph"><div><h1>{{ title() }}</h1>@if (subtitle()) { <p class="muted">{{ subtitle() }}</p> }</div><div class="ph-actions"><ng-content /></div></header>`,
  styles: [`.ph{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:flex-start;margin:4px 0 20px}.ph h1{margin:0;font-size:1.6rem}.ph p{margin:4px 0 0}.ph-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}`],
})
export class PageHeaderComponent { readonly title = input.required<string>(); readonly subtitle = input<string>(''); }

@Component({
  selector: 'app-status-chip', imports: [StatusLabelPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="tone()" [attr.aria-label]="'Status: ' + (status() | statusLabel)">{{ status() | statusLabel }}</span>`,
  styles: [`.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.78rem;font-weight:600;white-space:nowrap;background:var(--c-surface-2);color:var(--c-text)}.ok{background:#dff5e3;color:#16602a}.warn{background:#fff1cf;color:#7a5200}.bad{background:#fde1e1;color:#8c1d1d}.info{background:#dde9fb;color:#16408f}`],
})
export class StatusChipComponent {
  readonly status = input.required<string | null | undefined>();
  readonly tone = computed(() => {
    const s = this.status() ?? '';
    if (['CONFIRMED', 'SUCCEEDED', 'ACTIVE', 'PROCESSED', 'AVAILABLE', 'REFUNDED'].includes(s)) return 'ok';
    if (['PENDING_PAYMENT', 'INITIATED', 'PARTIALLY_CANCELLED', 'PARTIALLY_REFUNDED', 'PENDING', 'INACTIVE'].includes(s)) return 'warn';
    if (['CANCELLED', 'FAILED', 'EXPIRED', 'SUSPENDED', 'SOLD_OUT', 'BLOCKED'].includes(s)) return 'bad';
    return 'info';
  });
}

@Component({
  selector: 'app-empty-state', imports: [MatIconModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="es" role="status"><mat-icon aria-hidden="true">{{ icon() }}</mat-icon><h3>{{ title() }}</h3>@if (message()) { <p class="muted">{{ message() }}</p> }<ng-content /></div>`,
  styles: [`.es{text-align:center;padding:40px 16px}.es mat-icon{font-size:48px;width:48px;height:48px;color:var(--c-muted)}.es h3{margin:8px 0 4px}`],
})
export class EmptyStateComponent { readonly icon = input('inbox'); readonly title = input('Nothing here yet'); readonly message = input(''); }

@Component({
  selector: 'app-error-state', imports: [MatIconModule, MatButtonModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="es" role="alert"><mat-icon aria-hidden="true">error_outline</mat-icon><h3>Something went wrong</h3><p class="muted">{{ message() }}</p><button mat-stroked-button (click)="retry.emit()">Try again</button></div>`,
  styles: [`.es{text-align:center;padding:40px 16px}.es mat-icon{font-size:48px;width:48px;height:48px;color:#b3261e}`],
})
export class ErrorStateComponent { readonly message = input('The data could not be loaded.'); readonly retry = output<void>(); }

/** Renders the first validation message of a control (client rules AND the server-supplied field error). */
@Component({
  selector: 'app-field-error', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (text(); as t) { <span>{{ t }}</span> }`,
})
export class FieldErrorComponent {
  readonly control = input.required<AbstractControl | null>();
  readonly label = input('This field');
  /** Re-evaluates whenever the control's value / status / touched state changes (control.events), so OnPush parents never show stale messages. */
  private readonly tick = toSignal(toObservable(this.control).pipe(switchMap((c) => (c ? c.events.pipe(startWith(null)) : of(null)))), { initialValue: null });
  readonly text = computed(() => { this.tick(); return this.message(); });
  private message() {
    const e = this.control()?.errors; if (!e) return '';
    if (e['server']) return e['server'] as string;
    if (e['required']) return `${this.label()} is required`;
    if (e['email']) return 'Enter a valid e-mail address';
    if (e['mobile']) return 'Enter a valid 10-digit Indian mobile number';
    if (e['minlength']) return `At least ${e['minlength'].requiredLength} characters`;
    if (e['maxlength']) return `At most ${e['maxlength'].requiredLength} characters`;
    if (e['pattern']) return `${this.label()} has an invalid format`;
    if (e['min']) return `Minimum is ${e['min'].min}`;
    if (e['max']) return `Maximum is ${e['max'].max}`;
    if (e['age']) return 'Enter an age between 1 and 120';
    if (e['mismatch']) return 'Values do not match';
    if (e['same']) return 'Must differ from the current password';
    if (e['pastDate']) return 'The date cannot be in the past';
    if (e['notSelected']) return 'Pick a station from the list';
    if (e['taken']) return 'Already in use';
    if (e['time']) return 'Use HH:mm';
    const pc = e['passwordComplexity'] as Record<string, boolean> | undefined;
    if (pc) return pc['minlength8'] ? 'At least 8 characters' : pc['upper'] ? 'Add an uppercase letter' : pc['lower'] ? 'Add a lowercase letter' : 'Add a digit';
    return 'Invalid value';
  }
}

/** Password input with visibility toggle (Reactive Forms control passed in). */
@Component({
  selector: 'app-password-field', imports: [MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, ReactiveFormsModule, FieldErrorComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field appearance="outline" class="full">
      <mat-label>{{ label() }}</mat-label>
      <input matInput [type]="visible() ? 'text' : 'password'" [formControl]="control()" [autocomplete]="autocomplete()" />
      <button mat-icon-button matSuffix type="button" (click)="visible.set(!visible())" [attr.aria-label]="visible() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="visible()">
        <mat-icon>{{ visible() ? 'visibility_off' : 'visibility' }}</mat-icon>
      </button>
      <mat-error><app-field-error [control]="control()" [label]="label()" /></mat-error>
    </mat-form-field>`,
})
export class PasswordFieldComponent {
  readonly control = input.required<FormControl<string>>(); readonly label = input('Password'); readonly autocomplete = input('current-password');
  readonly visible = signal(false);
}

@Component({
  selector: 'app-global-progress', imports: [MatProgressBarModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (loading.busy()) { <mat-progress-bar mode="indeterminate" class="gp" aria-label="Loading" /> }`,
  styles: [`.gp{position:fixed;top:0;left:0;right:0;z-index:2000;height:3px}`],
})
export class GlobalProgressComponent { readonly loading = inject(LoadingService); }

export interface ConfirmData { title: string; message: string; confirmText?: string; danger?: boolean; withReason?: boolean }
@Component({
  selector: 'app-confirm-dialog', imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content><p>{{ data.message }}</p>
      @if (data.withReason) { <mat-form-field appearance="outline" class="full"><mat-label>Reason (optional)</mat-label><input matInput [formControl]="reason" maxlength="200" /></mat-form-field> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [color]="data.danger ? 'warn' : 'primary'" [mat-dialog-close]="data.withReason ? { reason: reason.value } : true" cdkFocusInitial>{{ data.confirmText ?? 'Confirm' }}</button>
    </mat-dialog-actions>`,
})
export class ConfirmDialogComponent { readonly data = inject<ConfirmData>(MAT_DIALOG_DATA); readonly ref = inject(MatDialogRef); readonly reason = new FormControl('', { nonNullable: true }); }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);
  /** Resolves true / {reason} when confirmed, falsy when dismissed. */
  ask(data: ConfirmData) { return firstValueFrom(this.dialog.open<ConfirmDialogComponent, ConfirmData, true | { reason: string }>(ConfirmDialogComponent, { data, width: '420px', autoFocus: false }).afterClosed()); }
}
