import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';

/** Mirrors the backend policy (10–72 chars, upper, lower, digit, special). The backend remains the final authority. */
export function passwordComplexity(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = (c.value ?? '') as string;
    if (!v) return null; // pair with Validators.required
    const missing: string[] = [];
    if (v.length < 10) missing.push('at least 10 characters');
    if (v.length > 72) missing.push('at most 72 characters');
    if (!/[a-z]/.test(v)) missing.push('a lowercase letter');
    if (!/[A-Z]/.test(v)) missing.push('an uppercase letter');
    if (!/\d/.test(v)) missing.push('a digit');
    if (!/[^A-Za-z0-9]/.test(v)) missing.push('a special character');
    return missing.length ? { passwordComplexity: { missing } } : null;
  };
}

/** Group validator: `target` must equal `source` (confirm password). Error is set on the target control too. */
export function matchFields(source: string, target: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(source);
    const b = group.get(target);
    if (!a || !b) return null;
    const mismatch = !!b.value && a.value !== b.value;
    const errors = { ...(b.errors ?? {}) };
    if (mismatch) errors['mismatch'] = true;
    else delete errors['mismatch'];
    b.setErrors(Object.keys(errors).length ? errors : null);
    return mismatch ? { mismatch: true } : null;
  };
}

/** Same rule as the backend (`USERNAME_RE`): 3–30 chars of letters/digits/./_/-, starting with a letter or digit. */
export function usernameFormat(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = ((c.value ?? '') as string).trim();
    return !v || /^[a-z0-9][a-z0-9._-]{2,29}$/i.test(v) ? null : { username: true };
  };
}

/** Same pattern the backend uses for `phone`. */
export function phoneNumber(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = (c.value ?? '') as string;
    return !v || /^[+\d][\d\s().-]{5,28}$/.test(v) ? null : { phone: true };
  };
}

/** Group validator for start ≤ end (ISO date strings compare correctly as text). Either side may be empty. */
export function dateRange(startKey: string, endKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const s = toIso(group.get(startKey)?.value);
    const e = toIso(group.get(endKey)?.value);
    return s && e && e < s ? { dateRange: { start: s, end: e } } : null;
  };
}

/** Numeric variant used by education years. */
export function numberRange(minKey: string, maxKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(minKey)?.value as number | null;
    const b = group.get(maxKey)?.value as number | null;
    return a != null && b != null && b < a ? { numberRange: true } : null;
  };
}

export function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${`${value.getMonth() + 1}`.padStart(2, '0')}-${`${value.getDate()}`.padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

export function pastDate(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const iso = toIso(c.value);
    return !iso || iso < toIso(new Date())! ? null : { pastDate: true };
  };
}

export function futureOrToday(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const iso = toIso(c.value);
    return !iso || iso >= toIso(new Date())! ? null : { notInPast: true };
  };
}

/** Conditional validation: apply `validator` only while `condition(control.parent)` is true. */
export function validateIf(condition: (parent: AbstractControl) => boolean, validator: ValidatorFn): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => (c.parent && condition(c.parent) ? validator(c) : null);
}

/** Async validator: debounced lookup against the backend. `exists` returns true when the value is already taken. */
export function uniqueValue(exists: (value: string) => Observable<boolean>, errorKey = 'taken', debounceMs = 400): AsyncValidatorFn {
  return (c: AbstractControl): Observable<ValidationErrors | null> => {
    const value = ((c.value ?? '') as string).trim();
    if (!value || c.hasError('email')) return of(null);
    return timer(debounceMs).pipe(
      switchMap(() => exists(value)),
      map((taken) => (taken ? { [errorKey]: true } : null)),
      catchError(() => of(null)), // never block the form because the check itself failed; backend validates on submit
    );
  };
}

/** Human-readable messages for the validation keys used in this app. */
export function errorMessage(c: AbstractControl | null, label = 'This field'): string {
  if (!c?.errors) return '';
  const e = c.errors;
  if (e['required']) return `${label} is required`;
  if (e['email']) return 'Enter a valid email address';
  if (e['taken']) return 'This email is already in use';
  if (e['usernameTaken']) return 'This username is already taken';
  if (e['minlength']) return `${label} must be at least ${(e['minlength'] as { requiredLength: number }).requiredLength} characters`;
  if (e['maxlength']) return `${label} must be at most ${(e['maxlength'] as { requiredLength: number }).requiredLength} characters`;
  if (e['min']) return `${label} must be at least ${(e['min'] as { min: number }).min}`;
  if (e['max']) return `${label} must be at most ${(e['max'] as { max: number }).max}`;
  if (e['username']) return 'Letters, digits, dot, underscore or hyphen; start with a letter or digit';
  if (e['pattern']) return `${label} has an invalid format`;
  if (e['phone']) return 'Enter a valid phone number';
  if (e['passwordComplexity']) return `Password needs ${(e['passwordComplexity'] as { missing: string[] }).missing.join(', ')}`;
  if (e['mismatch']) return 'Values do not match';
  if (e['pastDate']) return 'Date must be in the past';
  if (e['notInPast']) return 'Date cannot be in the past';
  if (e['server']) return String(e['server']);
  return 'Invalid value';
}
