import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError } from '../../core/models/api.models';
import { ALL_ROLES, Role } from '../../core/models/auth.models';
import { HasUnsavedChanges } from '../../core/guards/guards';
import { EmployeeService } from '../../core/services/employee.service';
import { ToastService } from '../../core/services/toast.service';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { PasswordStrengthComponent } from '../../shared/components/password-strength.component';
import { NoticeBannerComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { errorMessage, matchFields, passwordComplexity } from '../../shared/validators/validators';

/** Create a login for an existing employee: POST /employees/:id/account. */
@Component({
  selector: 'app-user-create',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, EmployeeSelectComponent, PageHeaderComponent, NoticeBannerComponent, PasswordStrengthComponent],
  template: `
    <div class="page narrow">
      <app-page-header title="Create login account" subtitle="Give an existing employee access to the system" />
      @if (error(); as e) { <div class="server-error" role="alert">{{ e.message }}</div> }
      <form class="panel" [formGroup]="form" (ngSubmit)="submit()" novalidate data-testid="account-form">
        <app-employee-select label="Employee" formControlName="employeeId" />
        @if (existingRole(); as r) {
          <app-notice-banner>This employee already has a login with role {{ r }}. Use the users list to change the role.</app-notice-banner>
        }
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role" data-testid="account-role">
            @for (r of roles; track r) { <mat-option [value]="r">{{ r.replace('_', ' ') }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Initial password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" data-testid="new-account-password" />
          <mat-hint>10–72 chars with upper, lower, digit and special character</mat-hint>
          <mat-error>{{ err('password', 'Password') }}</mat-error>
        </mat-form-field>
        <app-password-strength [password]="form.controls.password.value" />
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Confirm password</mat-label>
          <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          <mat-error>{{ err('confirm', 'Confirmation') }}</mat-error>
        </mat-form-field>
        <div class="actions">
          <a mat-button routerLink="/users">Cancel</a>
          <button mat-flat-button color="primary" type="submit" [disabled]="saving() || !!existingRole()" data-testid="create-account">Create account</button>
        </div>
      </form>
    </div>
  `,
  styles: `.narrow { max-width: 600px; } .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; } .server-error { background: #fce8e6; color: #c5221f; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }`,
})
export class UserCreateComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly employees = inject(EmployeeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly roles = ALL_ROLES;
  protected readonly saving = signal(false);
  protected readonly error = signal<AppError | null>(null);
  private submitted = false;

  protected readonly form = this.fb.group(
    {
      employeeId: this.fb.control<number | null>(null, Validators.required),
      role: this.fb.control<Role>('EMPLOYEE'),
      password: ['', [Validators.required, passwordComplexity()]],
      confirm: ['', Validators.required],
    },
    { validators: matchFields('password', 'confirm') },
  );
  protected readonly err = (n: 'password' | 'confirm', l: string) => errorMessage(this.form.controls[n], l);

  /** When an employee is picked, look up whether they already have an account (switchMap cancels stale lookups). */
  protected readonly existingRole = toSignal(
    this.form.controls.employeeId.valueChanges.pipe(
      startWith(null),
      switchMap((id) => (id ? this.employees.get(id).pipe(map((e) => e.account?.role ?? null), catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null },
  );

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.submitted;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.employees.createAccount(v.employeeId!, { role: v.role, password: v.password }).subscribe({
      next: () => {
        this.submitted = true;
        this.toast.success('Login account created');
        void this.router.navigate(['/users', v.employeeId]);
      },
      error: (e: AppError) => {
        this.saving.set(false);
        this.error.set(e);
      },
    });
  }
}
