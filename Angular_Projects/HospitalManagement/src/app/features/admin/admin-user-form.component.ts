import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { UserApiService } from '../../core/api/auth-api.service';
import type { Role, UserAccount } from '../../core/models';
import { ApiError } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { strongPassword } from '../../shared/validators/validators';

/** NON-STANDALONE child component: @Output EventEmitter + classic (untyped-builder) Reactive Form. */
@Component({
  selector: 'app-admin-user-form',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5 dark:border-slate-700 dark:bg-slate-900" aria-label="Create account">
      <input class="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" formControlName="username" placeholder="Username" aria-label="Username" />
      <input class="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" formControlName="email" type="email" placeholder="E-mail" aria-label="E-mail" />
      <input class="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" formControlName="password" type="password" placeholder="Password" aria-label="Password" autocomplete="new-password" />
      <select class="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600" formControlName="role" aria-label="Role"><option *ngFor="let r of roles" [value]="r">{{ r }}</option></select>
      <button type="submit" class="rounded-md bg-brand-600 px-3 py-2 text-sm text-white disabled:opacity-60" [disabled]="busy">{{ busy ? 'Creating…' : 'Create account' }}</button>
      <p class="text-xs text-red-600 sm:col-span-5" *ngIf="form.touched && form.invalid">Username 3+ chars, valid e-mail and a strong password (8+, upper, lower, digit) are required.</p>
      <p class="text-xs text-red-600 sm:col-span-5" role="alert" *ngIf="error">{{ error }}</p>
    </form>`,
})
export class AdminUserFormComponent {
  @Output() created = new EventEmitter<UserAccount>();
  readonly roles: Role[] = ['DOCTOR', 'LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF', 'ADMIN'];
  busy = false;
  error: string | null = null;
  readonly form;
  constructor(private readonly fb: FormBuilder, private readonly api: UserApiService, private readonly notify: NotificationService) {
    this.form = this.fb.group({ username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]], email: ['', [Validators.required, Validators.email]], password: ['', [Validators.required, strongPassword]], role: ['DOCTOR', Validators.required] });
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy = true; this.error = null;
    this.api.create(this.form.getRawValue() as never).subscribe({
      next: (u) => { this.busy = false; this.notify.success(`Account ${u.username} created`); this.form.reset({ role: 'DOCTOR' }); this.created.emit(u); },
      error: (e: unknown) => { this.busy = false; this.error = ApiError.from(e).message; },
    });
  }
}
