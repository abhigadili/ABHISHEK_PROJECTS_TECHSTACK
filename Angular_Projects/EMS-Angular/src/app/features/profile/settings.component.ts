import { ChangeDetectionStrategy, Component, Directive, inject, signal } from '@angular/core';
import { FormsModule, NG_VALIDATORS, NgForm, AbstractControl, ValidationErrors, Validator } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DEFAULT_PREFERENCES, PreferencesService, UserPreferences } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { NoticeBannerComponent, PageHeaderComponent } from '../../shared/components/ui-basics';

/** Template-driven custom validator (directive form): the display name may not be only digits. */
@Directive({
  selector: '[appNotOnlyDigits]',
  standalone: true,
  providers: [{ provide: NG_VALIDATORS, useExisting: NotOnlyDigitsDirective, multi: true }],
})
export class NotOnlyDigitsDirective implements Validator {
  validate(c: AbstractControl): ValidationErrors | null {
    const v = (c.value ?? '') as string;
    return v && /^\d+$/.test(v) ? { onlyDigits: true } : null;
  }
}

/**
 * Settings = the app's Template-driven form: FormsModule, ngForm, ngModel, ngModelGroup, ngModelOptions,
 * (ngSubmit), built-in validators (required / minlength / maxlength / pattern / min / max), a custom validator directive,
 * template reference variables and state-driven messages. Chosen over Reactive Forms because the form is flat,
 * has no dynamic rows and no cross-field rules — the template is the simplest place to declare it.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default, // ngModel writes happen outside signals; Default keeps this form simple
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, PageHeaderComponent, NoticeBannerComponent, NotOnlyDigitsDirective],
  template: `
    <div class="page narrow">
      <app-page-header title="Settings" subtitle="Personal preferences for this browser" />
      <app-notice-banner>These preferences are stored in this browser only (the backend has no preferences API).</app-notice-banner>

      <form class="panel" #f="ngForm" (ngSubmit)="save(f)" novalidate data-testid="settings-form">
        <div ngModelGroup="display" #display="ngModelGroup">
          <h3>Display</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Display name (optional)</mat-label>
            <input matInput name="displayName" [(ngModel)]="model.displayName" #displayName="ngModel" minlength="2" maxlength="40" appNotOnlyDigits
              [ngModelOptions]="{ updateOn: 'blur' }" data-testid="settings-display-name" />
            @if (displayName.invalid && (displayName.dirty || displayName.touched || f.submitted)) {
              <mat-error>
                @if (displayName.errors?.['minlength']) { At least 2 characters }
                @else if (displayName.errors?.['onlyDigits']) { The name cannot be only digits }
                @else { Invalid name }
              </mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Landing page after sign-in</mat-label>
            <mat-select name="landingPage" [(ngModel)]="model.landingPage" required>
              <mat-option value="dashboard">Dashboard</mat-option>
              <mat-option value="employees">Employees</mat-option>
              <mat-option value="attendance">Attendance</mat-option>
              <mat-option value="leaves">Leave</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Default rows per page (5–50)</mat-label>
            <input matInput type="number" name="pageSize" [(ngModel)]="model.pageSize" #pageSize="ngModel" required min="5" max="50" data-testid="settings-page-size" />
            @if (pageSize.invalid && (pageSize.dirty || pageSize.touched || f.submitted)) {
              <mat-error>Enter a number between 5 and 50</mat-error>
            }
          </mat-form-field>
        </div>

        <div ngModelGroup="notifications" #notif="ngModelGroup">
          <h3>Notifications</h3>
          <mat-checkbox name="emailDigest" [(ngModel)]="model.emailDigest">Daily e-mail digest</mat-checkbox><br />
          <mat-checkbox name="notifyLeaveDecisions" [(ngModel)]="model.notifyLeaveDecisions">Tell me when my leave is decided</mat-checkbox><br />
          <mat-checkbox name="notifyBirthdays" [(ngModel)]="model.notifyBirthdays">Show birthdays & anniversaries</mat-checkbox>
        </div>

        <p class="state muted" data-testid="settings-state">
          Form is {{ f.valid ? 'valid' : 'invalid' }} · {{ f.dirty ? 'unsaved changes' : 'no changes' }}@if (saved()) { · saved }
        </p>
        <div class="actions">
          <button mat-button type="button" (click)="reset(f)">Restore defaults</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="f.invalid || f.pristine" data-testid="settings-save">Save settings</button>
        </div>
      </form>
    </div>
  `,
  styles: `.narrow { max-width: 620px; } h3 { margin: 16px 0 8px; font-weight: 500; } .actions { display: flex; justify-content: flex-end; gap: 8px; } .state { font-size: 13px; }`,
})
export class SettingsComponent {
  private readonly prefs = inject(PreferencesService);
  private readonly toast = inject(ToastService);

  protected model: UserPreferences = { ...this.prefs.prefs() };
  protected readonly saved = signal(false);

  protected save(f: NgForm): void {
    if (f.invalid) return;
    this.prefs.update({ ...this.model });
    f.form.markAsPristine();
    this.saved.set(true);
    this.toast.success('Settings saved');
  }

  protected reset(f: NgForm): void {
    this.model = { ...DEFAULT_PREFERENCES };
    f.form.markAsDirty();
    this.saved.set(false);
  }
}
