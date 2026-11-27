import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { catchError, of, tap } from 'rxjs';
import { AppError } from '../../core/models/api.models';
import { Employee } from '../../core/models/employee.models';
import { HasUnsavedChanges } from '../../core/guards/guards';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { ProfilePictureComponent } from '../../shared/components/profile-picture.component';
import { EmptyStateComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { errorMessage, phoneNumber } from '../../shared/validators/validators';

const nz = (v: string): string | null => (v.trim() ? v.trim() : null);

/** Self-service profile: only the fields the backend lets an employee change (contact, address, emergency contact). */
@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, ProfilePictureComponent, FileUploadComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <div class="page narrow">
      <app-page-header title="My profile" subtitle="Update your contact details">
        <a pageActions mat-stroked-button routerLink="/profile/change-password"><mat-icon>lock</mat-icon> Change password</a>
      </app-page-header>
      @if (profile(); as p) {
        <section class="panel head">
          <app-profile-picture [employeeId]="p.id" [hasPicture]="hasPicture()" [name]="p.fullName" [size]="88" />
          <div>
            <h2>{{ p.fullName }}</h2>
            <div class="muted">{{ p.jobTitle || p.designation?.name || '—' }} · {{ p.department?.name || 'No department' }}</div>
            <div class="muted">{{ p.workEmail }} · {{ p.employeeCode }}</div>
            <div class="pic"><app-file-upload label="Change picture" icon="photo_camera" (fileSelected)="upload($event)" />
              @if (hasPicture()) { <button mat-button color="warn" type="button" (click)="removePicture()">Remove</button> }</div>
          </div>
        </section>
        @if (error(); as e) { <div class="server-error" role="alert">{{ e.message }}</div> }
        <form class="panel" [formGroup]="form" (ngSubmit)="save()" novalidate data-testid="profile-form">
          <div class="form-grid">
            <mat-form-field appearance="outline"><mat-label>Personal email</mat-label><input matInput type="email" formControlName="personalEmail" /><mat-error>{{ err('personalEmail', 'Email') }}</mat-error></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput type="tel" formControlName="phone" data-testid="profile-phone" /><mat-error>{{ err('phone', 'Phone') }}</mat-error></mat-form-field>
          </div>
          <div class="form-grid" formGroupName="address">
            <mat-form-field appearance="outline"><mat-label>Address</mat-label><input matInput formControlName="line" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>City</mat-label><input matInput formControlName="city" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>State</mat-label><input matInput formControlName="state" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Country</mat-label><input matInput formControlName="country" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Postal code</mat-label><input matInput formControlName="postalCode" /></mat-form-field>
          </div>
          <h3>Emergency contact</h3>
          <div class="form-grid" formGroupName="emergency">
            <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput type="tel" formControlName="phone" /><mat-error>{{ err('emergency.phone', 'Phone') }}</mat-error></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Relationship</mat-label><input matInput formControlName="relation" /></mat-form-field>
          </div>
          <div class="actions"><button mat-flat-button color="primary" type="submit" [disabled]="saving() || form.pristine" data-testid="profile-save">Save changes</button></div>
        </form>
      } @else {
        <app-empty-state icon="person_off" title="No employee profile" message="Your login is not linked to an employee record." />
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 820px; }
    .head { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    h2 { margin: 0 0 4px; font-weight: 500; }
    h3 { margin: 8px 0 12px; font-weight: 500; }
    .pic { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
    .actions { display: flex; justify-content: flex-end; }
    .server-error { background: #fce8e6; color: #c5221f; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }
  `,
})
export class ProfileComponent implements HasUnsavedChanges {
  private readonly profiles = inject(ProfileService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly saving = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly hasPicture = signal(false);

  protected readonly form = this.fb.group({
    personalEmail: ['', [Validators.email]],
    phone: ['', [phoneNumber()]],
    address: this.fb.group({ line: [''], city: [''], state: [''], country: [''], postalCode: [''] }),
    emergency: this.fb.group({ name: [''], phone: ['', [phoneNumber()]], relation: [''] }),
  });
  protected readonly err = (p: string, l: string) => errorMessage(this.form.get(p), l);

  protected readonly profile = toSignal(
    this.auth.employeeId() ? this.profiles.get().pipe(tap((p) => this.fill(p)), catchError(() => of(null))) : of(null),
    { initialValue: null as Employee | null },
  );

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  private fill(p: Employee): void {
    this.hasPicture.set(!!p.profilePictureUrl);
    this.form.reset({
      personalEmail: p.personalEmail ?? '', phone: p.phone ?? '',
      address: { line: p.address?.line ?? '', city: p.address?.city ?? '', state: p.address?.state ?? '', country: p.address?.country ?? '', postalCode: p.address?.postalCode ?? '' },
      emergency: { name: p.emergencyContact?.name ?? '', phone: p.emergencyContact?.phone ?? '', relation: p.emergencyContact?.relation ?? '' },
    });
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.profiles
      .update({
        personalEmail: nz(v.personalEmail), phone: nz(v.phone),
        addressLine: nz(v.address.line), city: nz(v.address.city), state: nz(v.address.state), country: nz(v.address.country), postalCode: nz(v.address.postalCode),
        emergencyContactName: nz(v.emergency.name), emergencyContactPhone: nz(v.emergency.phone), emergencyContactRelation: nz(v.emergency.relation),
      })
      .subscribe({
        next: (p) => {
          this.fill(p);
          this.saving.set(false);
          this.toast.success('Profile updated');
        },
        error: (e: AppError) => {
          this.saving.set(false);
          this.error.set(e);
          for (const d of e.details) this.form.get(d.field)?.setErrors({ server: d.message });
        },
      });
  }

  protected upload(file: File): void {
    this.profiles.uploadPicture(file).subscribe({
      next: () => { this.hasPicture.set(true); this.toast.success('Picture updated'); },
      error: (e: AppError) => this.toast.error(e.message),
    });
  }

  protected removePicture(): void {
    this.profiles.removePicture().subscribe(() => { this.hasPicture.set(false); this.toast.success('Picture removed'); });
  }
}
