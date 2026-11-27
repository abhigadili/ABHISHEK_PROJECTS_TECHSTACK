import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABEL } from '../../core/auth/permissions';
import type { HasUnsavedChanges } from '../../core/guards/guards';
import type { NotificationPrefs } from '../../core/models/models';
import { NotificationApi, UserService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { applyServerErrors, indianMobile } from '../../shared/validators/validators';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, FormsModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, PageHeaderComponent, FieldErrorComponent, DigitsOnlyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="My profile" subtitle="Personal details and notification preferences"><a mat-stroked-button routerLink="password">Change password</a></app-page-header>
    <div class="grid cols-2">
      <section class="card">
        <h2>Details</h2>
        <p class="muted">{{ auth.user()?.email }} · {{ roles() }}<br />Member since {{ auth.user()?.createdAt | date: 'dd MMM yyyy' }}</p>
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <mat-form-field class="full"><mat-label>Full name</mat-label><input matInput formControlName="name" /><mat-error><app-field-error [control]="form.controls.name" label="Name" /></mat-error></mat-form-field>
          <mat-form-field class="full"><mat-label>Mobile</mat-label><span matTextPrefix>+91&nbsp;</span><input matInput formControlName="mobile" maxlength="10" appDigitsOnly /><mat-error><app-field-error [control]="form.controls.mobile" label="Mobile" /></mat-error></mat-form-field>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <button mat-flat-button type="submit" [disabled]="busy() || form.pristine">Save changes</button>
        </form>
      </section>
      <section class="card">
        <h2>Notification preferences</h2>
        <!-- template-driven toggles (ngModel) -->
        <form #pf="ngForm">
          <p><mat-slide-toggle name="inApp" [(ngModel)]="prefs.inApp" (ngModelChange)="savePrefs()">In-app notifications</mat-slide-toggle></p>
          <p><mat-slide-toggle name="email" [(ngModel)]="prefs.email" (ngModelChange)="savePrefs()">E-mail notifications</mat-slide-toggle></p>
        </form>
      </section>
    </div>`,
})
export class ProfileComponent implements OnInit, HasUnsavedChanges {
  readonly auth = inject(AuthService); private readonly users = inject(UserService); private readonly notif = inject(NotificationApi); private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly busy = signal(false); readonly error = signal('');
  prefs: NotificationPrefs = { inApp: true, email: true };
  readonly form = this.fb.group({ name: [this.auth.user()?.name ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]], mobile: [this.auth.user()?.mobile ?? '', [Validators.required, indianMobile]] });
  roles() { return this.auth.roles().map((r) => ROLE_LABEL[r]).join(', '); }
  hasUnsavedChanges() { return this.form.dirty; }
  ngOnInit() { this.notif.prefs().subscribe((p) => (this.prefs = { inApp: p.inApp, email: p.email })); }
  save() {
    this.form.markAllAsTouched(); const u = this.auth.user(); if (this.form.invalid || !u) return;
    this.busy.set(true); this.error.set('');
    this.users.update(u.id, this.form.getRawValue()).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (nu) => { this.auth.updateCurrent(nu); this.form.markAsPristine(); this.toast.success('Profile updated.'); },
      error: (e) => { const err = toApiError(e); applyServerErrors(this.form, err.fields); this.error.set(err.message); },
    });
  }
  savePrefs() { this.notif.setPrefs(this.prefs).subscribe({ next: () => this.toast.success('Preferences saved.') }); }
}
