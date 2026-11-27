import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { toApiError } from '../../core/interceptors/error.interceptor';

/** TEMPLATE-DRIVEN form (ngForm / ngModel / template reference variables) - a one-field form is the right use for it. */
@Component({
  selector: 'app-forgot-password', imports: [FormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Forgot your password?</h1>
    @if (sent()) { <p role="status">{{ sent() }}</p><a mat-stroked-button routerLink="/auth/login">Back to sign in</a> }
    @else {
      <p class="muted">Enter your e-mail and we'll send a reset link.</p>
      <form #f="ngForm" (ngSubmit)="submit(f)" novalidate>
        <mat-form-field class="full"><mat-label>E-mail</mat-label>
          <input matInput type="email" name="email" [(ngModel)]="email" #em="ngModel" required email maxlength="160" autocomplete="email" />
          @if (em.invalid && (em.touched || f.submitted)) { <mat-error>{{ em.errors?.['required'] ? 'E-mail is required' : 'Enter a valid e-mail address' }}</mat-error> }
        </mat-form-field>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <button mat-flat-button type="submit" class="full" [disabled]="busy()">Send reset link</button>
      </form>
      <p><a routerLink="/auth/login">Back to sign in</a></p>
    }`,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  email = '';
  readonly busy = signal(false); readonly error = signal(''); readonly sent = signal('');
  submit(f: NgForm) {
    if (f.invalid || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.auth.forgotPassword(this.email).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (r) => this.sent.set(r.message), error: (e) => this.error.set(toApiError(e).message) });
  }
}
