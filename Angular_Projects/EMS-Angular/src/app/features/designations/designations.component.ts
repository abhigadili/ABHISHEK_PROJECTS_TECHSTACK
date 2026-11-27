import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { Designation } from '../../core/models/organization.models';
import { DesignationService } from '../../core/services/designation.service';
import { ToastService } from '../../core/services/toast.service';
import { CellDirective, DataTableComponent, TableColumn } from '../../shared/components/data-table.component';
import { DialogFrameComponent } from '../../shared/components/dialogs';
import { SearchBoxComponent } from '../../shared/components/search-box.component';
import { ErrorMessageComponent, PageHeaderComponent, StatusBadgeComponent } from '../../shared/components/ui-basics';
import { HasPermissionDirective } from '../../shared/directives/directives';
import { errorMessage } from '../../shared/validators/validators';

/** Create/edit dialog: FormBuilder with job level (grade) range validation. */
@Component({
  selector: 'app-designation-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, DialogFrameComponent],
  template: `
    <app-dialog-frame [title]="data ? 'Edit designation' : 'New designation'">
      <form [formGroup]="form" id="designation-form" (ngSubmit)="save()" novalidate>
        @if (error(); as e) {
          <p class="err" role="alert">{{ e.message }}</p>
        }
        <mat-form-field appearance="outline" class="full">
          <mat-label>Name / job title</mat-label>
          <input matInput formControlName="name" data-testid="designation-name" />
          <mat-error>{{ err('name', 'Name') }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Job level / grade (1–20)</mat-label>
          <input matInput type="number" formControlName="jobLevel" data-testid="designation-level" />
          <mat-error>{{ err('jobLevel', 'Job level') }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        @if (data) {
          <mat-checkbox formControlName="isActive">Active</mat-checkbox>
        }
      </form>
      <button dialogActions mat-button type="button" mat-dialog-close>Cancel</button>
      <button dialogActions mat-flat-button color="primary" type="submit" form="designation-form" [disabled]="busy()" data-testid="designation-save">Save</button>
    </app-dialog-frame>
  `,
  styles: `.full { width: 100%; min-width: min(380px, 80vw); } .err { color: #c5221f; }`,
})
export class DesignationDialogComponent {
  protected readonly data = inject<Designation | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DesignationDialogComponent, boolean>>(MatDialogRef);
  private readonly svc = inject(DesignationService);
  private readonly fb = inject(FormBuilder);
  protected readonly busy = signal(false);
  protected readonly error = signal<AppError | null>(null);

  protected readonly form = this.fb.group({
    name: [this.data?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    jobLevel: this.fb.control<number | null>(this.data?.jobLevel ?? null, [Validators.min(1), Validators.max(20)]),
    description: [this.data?.description ?? '', [Validators.maxLength(500)]],
    isActive: [this.data?.isActive ?? true],
  });
  protected readonly err = (n: 'name' | 'jobLevel', l: string) => errorMessage(this.form.controls[n], l);

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const body = { name: v.name!.trim(), jobLevel: v.jobLevel ?? null, description: v.description?.trim() || null, ...(this.data ? { isActive: !!v.isActive } : {}) };
    this.busy.set(true);
    (this.data ? this.svc.update(this.data.id, body) : this.svc.create(body)).subscribe({
      next: () => this.ref.close(true),
      error: (e: AppError) => {
        this.error.set(e);
        this.busy.set(false);
      },
    });
  }
}

interface Result { items: Designation[]; meta: PageMeta | null; error: AppError | null }

@Component({
  selector: 'app-designations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, DataTableComponent, CellDirective, SearchBoxComponent, PageHeaderComponent, ErrorMessageComponent, StatusBadgeComponent, HasPermissionDirective],
  template: `
    <div class="page">
      <app-page-header title="Designations" subtitle="Job titles with their level/grade and headcount">
        <button pageActions mat-flat-button type="button" *appHasPermission="'designation.write'" (click)="edit(null)" data-testid="new-designation"><mat-icon>add</mat-icon> New designation</button>
      </app-page-header>
      <div class="panel">
        <div class="toolbar-row"><app-search-box label="Search designations" (searchChange)="q.set($event); page.set(1)" /></div>
        <app-error-message [error]="result().error" (retry)="reload()" />
        <app-data-table testId="designation-table" [columns]="columns" [rows]="result().items" [meta]="result().meta" emptyIcon="badge" emptyTitle="No designations found" (pageChange)="page.set($event.page); limit.set($event.limit)">
          <ng-template appCell="jobLevel" let-d>{{ d.jobLevel ? 'L' + d.jobLevel : '—' }}</ng-template>
          <ng-template appCell="isActive" let-d><app-status-badge [value]="d.isActive" [label]="d.isActive ? 'Active' : 'Inactive'" /></ng-template>
          <ng-template appCell="actions" let-d>
            <div class="row-actions" *appHasPermission="'designation.write'">
              <button mat-icon-button type="button" matTooltip="Edit" aria-label="Edit designation" (click)="edit(d)"><mat-icon>edit</mat-icon></button>
            </div>
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
})
export class DesignationsComponent {
  private readonly svc = inject(DesignationService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  private readonly refresh = signal(0);
  private readonly query = computed(() => ({ q: this.q(), page: this.page(), limit: this.limit(), v: this.refresh() }));

  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      switchMap((f) =>
        this.svc.list(f).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
          startWith<Result | null>(null),
        ),
      ),
      map((r) => r ?? { items: [], meta: null, error: null }),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Designation' },
    { key: 'jobLevel', label: 'Level / grade' },
    { key: 'description', label: 'Description' },
    { key: 'headcount', label: 'Employees', align: 'end' },
    { key: 'isActive', label: 'Status' },
    { key: 'actions', label: '', align: 'end' },
  ];

  protected edit(d: Designation | null): void {
    this.dialog.open<DesignationDialogComponent, Designation | null, boolean>(DesignationDialogComponent, { data: d, maxWidth: '95vw' }).afterClosed().subscribe((saved) => {
      if (saved) {
        this.toast.success(d ? 'Designation updated' : 'Designation created');
        this.reload();
      }
    });
  }

  protected reload(): void {
    this.refresh.update((n) => n + 1);
  }
}
