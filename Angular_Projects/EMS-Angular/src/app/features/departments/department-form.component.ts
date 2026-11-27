import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppError, ValidationDetail } from '../../core/models/api.models';
import { Department } from '../../core/models/organization.models';
import { HasUnsavedChanges } from '../../core/guards/guards';
import { DepartmentService } from '../../core/services/department.service';
import { ToastService } from '../../core/services/toast.service';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { PageHeaderComponent } from '../../shared/components/ui-basics';
import { AutofocusDirective } from '../../shared/directives/directives';
import { errorMessage } from '../../shared/validators/validators';

/**
 * Create/edit department with the classic (nullable) FormBuilder. The resolved `department` arrives through the
 * route-to-input binding (withComponentInputBinding): undefined on /new, the entity on /:id/edit.
 */
@Component({
  selector: 'app-department-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, PageHeaderComponent, EmployeeSelectComponent, AutofocusDirective],
  template: `
    <div class="page narrow">
      <app-page-header [title]="department() ? 'Edit department' : 'New department'" />
      @if (error(); as e) {
        <div class="server-error" role="alert">{{ e.message }}</div>
      }
      <form class="panel" [formGroup]="form" (ngSubmit)="submit()" novalidate data-testid="department-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Code</mat-label>
          <input matInput formControlName="code" appAutofocus (input)="upper()" placeholder="ENG" data-testid="dept-code" />
          <mat-hint>Upper-case letters, digits, _ or -</mat-hint>
          <mat-error>{{ err('code', 'Code') }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" data-testid="dept-name" />
          <mat-error>{{ err('name', 'Name') }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
          <mat-error>{{ err('description', 'Description') }}</mat-error>
        </mat-form-field>
        <app-employee-select label="Department head" formControlName="headEmployeeId" />
        <div class="actions">
          <a mat-button routerLink=".." data-testid="cancel">Cancel</a>
          <button mat-flat-button color="primary" type="submit" [disabled]="saving()" data-testid="save-department">Save</button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .narrow { max-width: 640px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .server-error { background: #fce8e6; color: #c5221f; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
  `,
})
export class DepartmentFormComponent implements HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly departments = inject(DepartmentService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Bound from the route's resolver data (key `department`). */
  readonly department = input<Department | undefined>(undefined);

  protected readonly saving = signal(false);
  protected readonly error = signal<AppError | null>(null);
  private submitted = false;

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Z0-9_-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    headEmployeeId: this.fb.control<number | null>(null),
  });
  protected readonly err = (n: 'code' | 'name' | 'description', l: string) => errorMessage(this.form.controls[n], l);

  constructor() {
    effect(() => {
      const d = this.department();
      untracked(() => {
        if (d) {
          this.form.patchValue({ code: d.code, name: d.name, description: d.description ?? '', headEmployeeId: d.headEmployeeId });
          this.form.markAsPristine();
        }
      });
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.submitted;
  }

  protected upper(): void {
    const c = this.form.controls.code;
    if (c.value && c.value !== c.value.toUpperCase()) c.setValue(c.value.toUpperCase());
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = { code: v.code!, name: v.name!.trim(), description: v.description?.trim() || null, headEmployeeId: v.headEmployeeId };
    const existing = this.department();
    this.saving.set(true);
    this.error.set(null);
    (existing ? this.departments.update(existing.id, body) : this.departments.create(body)).subscribe({
      next: (saved) => {
        this.submitted = true;
        this.toast.success(existing ? 'Department updated' : 'Department created');
        void this.router.navigate(['/departments', saved.id]);
      },
      error: (e: AppError) => {
        this.saving.set(false);
        this.error.set(e);
        this.mapServerErrors(e.details);
      },
    });
  }

  private mapServerErrors(details: ValidationDetail[]): void {
    for (const d of details) {
      const c = this.form.get(d.field);
      if (c) {
        c.setErrors({ ...(c.errors ?? {}), server: d.message });
        c.markAsTouched();
      }
    }
  }
}
