import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import type { Station } from '../../core/models/models';
import { StationService } from '../../core/services/catalog.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { Column, DataTableComponent } from '../../shared/components/data-table.component';
import { ConfirmService, FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { UppercaseDirective } from '../../shared/directives/directives';
import { listState } from '../../shared/list-state';
import { applyServerErrors, uniqueAsync } from '../../shared/validators/validators';

@Component({
  selector: 'app-station-dialog', imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, FieldErrorComponent, UppercaseDirective], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>{{ data ? 'Edit station' : 'New station' }}</h2><form [formGroup]="form" (ngSubmit)="save()" novalidate><mat-dialog-content class="dc">
    <mat-form-field><mat-label>Code</mat-label><input matInput formControlName="code" appUppercase maxlength="6" /><mat-hint>2-6 capital letters</mat-hint><mat-error><app-field-error [control]="form.controls.code" label="Code" /></mat-error></mat-form-field>
    <mat-form-field><mat-label>Name</mat-label><input matInput formControlName="name" /><mat-error><app-field-error [control]="form.controls.name" label="Name" /></mat-error></mat-form-field>
    <mat-form-field><mat-label>City</mat-label><input matInput formControlName="city" /><mat-error><app-field-error [control]="form.controls.city" label="City" /></mat-error></mat-form-field>
    <mat-form-field><mat-label>State</mat-label><input matInput formControlName="state" /><mat-error><app-field-error [control]="form.controls.state" label="State" /></mat-error></mat-form-field>
    <mat-slide-toggle formControlName="active">Active (selectable in searches)</mat-slide-toggle>
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }</mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Cancel</button><button mat-flat-button type="submit" [disabled]="busy() || form.pending">Save</button></mat-dialog-actions></form>`,
  styles: [`.dc{display:flex;flex-direction:column;gap:4px;min-width:min(400px,80vw)}`],
})
export class StationDialogComponent {
  private readonly api = inject(StationService); private readonly ref = inject(MatDialogRef<StationDialogComponent>); private readonly fb = inject(NonNullableFormBuilder);
  readonly data = inject<Station | null>(MAT_DIALOG_DATA); readonly busy = signal(false); readonly error = signal('');
  /** Async validator: debounced backend lookup keeps station codes unique (the server also enforces it). */
  readonly form = this.fb.group({
    code: this.fb.control(this.data?.code ?? '', { validators: [Validators.required, Validators.pattern(/^[A-Z]{2,6}$/)], asyncValidators: [uniqueAsync((v) => this.api.codeTaken(v, this.data?.id))] }),
    name: [this.data?.name ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]], city: [this.data?.city ?? '', [Validators.required, Validators.minLength(2)]],
    state: [this.data?.state ?? '', [Validators.required, Validators.minLength(2)]], active: [this.data?.active ?? true],
  });
  save() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return; this.busy.set(true);
    const v = this.form.getRawValue(); const req = this.data ? this.api.update(this.data.id, v) : this.api.create(v);
    req.pipe(finalize(() => this.busy.set(false))).subscribe({ next: (s) => this.ref.close(s), error: (e) => { const er = toApiError(e); applyServerErrors(this.form, er.fields); this.error.set(er.message); } });
  }
}

@Component({
  selector: 'app-stations-admin', imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatDialogModule, DataTableComponent, PageHeaderComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Stations" subtitle="Create, edit or deactivate stations"><button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon>New station</button></app-page-header>
    <mat-form-field class="full"><mat-label>Search</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [formControl]="l.search" /></mat-form-field>
    <app-data-table [columns]="columns" [rows]="l.rows()" [meta]="l.meta()" [loading]="l.loading()" [error]="l.error()" [sortActive]="l.sortActive" [sortDir]="l.sortDir" (pageChange)="l.page$.next($event)" (sortChange)="l.sort$.next($event)" (retry)="l.reload()">
      <ng-template #actions let-s><button mat-icon-button (click)="edit(s)" [attr.aria-label]="'Edit ' + s.name"><mat-icon>edit</mat-icon></button><button mat-icon-button (click)="remove(s)" [attr.aria-label]="'Delete ' + s.name"><mat-icon>delete</mat-icon></button></ng-template>
    </app-data-table>`,
})
export class StationsAdminComponent {
  private readonly api = inject(StationService); private readonly dialog = inject(MatDialog); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService);
  readonly l = listState<Station>((q) => this.api.list(q), { sort: 'name' });
  readonly columns: Column<Station>[] = [{ key: 'code', label: 'Code', sortable: true }, { key: 'name', label: 'Name', sortable: true }, { key: 'city', label: 'City', sortable: true }, { key: 'state', label: 'State', sortable: true }, { key: 'routes', label: 'Routes', value: (s) => s._count?.routeStops ?? 0 }, { key: 'active', label: 'Status', kind: 'chip', value: (s) => (s.active ? 'ACTIVE' : 'INACTIVE') }];
  edit(s: Station | null) { this.dialog.open(StationDialogComponent, { data: s }).afterClosed().subscribe((r) => { if (r) { this.toast.success('Station saved.'); this.l.reload(); } }); }
  async remove(s: Station) { if (await this.confirm.ask({ title: 'Delete station?', message: `${s.name} will be deleted. Stations used by routes or bookings cannot be deleted - deactivate them instead.`, confirmText: 'Delete', danger: true })) this.api.remove(s.id).subscribe({ next: () => { this.toast.success('Station deleted.'); this.l.reload(); }, error: (e) => this.toast.error(toApiError(e).message) }); }
}
