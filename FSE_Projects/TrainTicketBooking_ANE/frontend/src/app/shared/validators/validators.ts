import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, map, of, switchMap, timer } from 'rxjs';

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
/** Same rules as the backend: >= 8 chars with upper, lower and a digit. Reports which rule is missing. */
export const passwordComplexity: ValidatorFn = (c) => {
  const v = (c.value as string) ?? '';
  if (!v) return null;
  const errors: Record<string, true> = {};
  if (v.length < 8) errors['minlength8'] = true;
  if (!/[A-Z]/.test(v)) errors['upper'] = true;
  if (!/[a-z]/.test(v)) errors['lower'] = true;
  if (!/\d/.test(v)) errors['digit'] = true;
  return Object.keys(errors).length ? { passwordComplexity: errors } : null;
};
export const indianMobile: ValidatorFn = (c) => (!c.value || /^[6-9]\d{9}$/.test(c.value) ? null : { mobile: true });
export const optionalMobile = indianMobile;
export const ageRange: ValidatorFn = (c) => { const n = Number(c.value); return c.value === null || c.value === '' || (Number.isInteger(n) && n >= 1 && n <= 120) ? null : { age: true }; };
/** The date must be today or later (ISO yyyy-mm-dd or Date). */
export const notPastDate: ValidatorFn = (c) => {
  if (!c.value) return null;
  const d = c.value instanceof Date ? c.value : new Date(c.value); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return d < t ? { pastDate: true } : null;
};
/**
 * Cross-field validators attach their error to the *target* control. The target is first re-validated with its OWN validators
 * (onlySelf, silent) so stale errors never survive, then the cross-field error is added.
 */
const withExtraError = (ctrl: AbstractControl, key: string, bad: boolean) => {
  ctrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  if (bad) ctrl.setErrors({ ...(ctrl.errors ?? {}), [key]: true });
};
/** Cross-field: two controls must hold the same value. Error is attached to the confirm control. */
export const matchFields = (a: string, b: string): ValidatorFn => (g: AbstractControl): ValidationErrors | null => {
  const x = g.get(a), y = g.get(b); if (!x || !y) return null;
  withExtraError(y, 'mismatch', !!y.value && x.value !== y.value);
  return null;
};
/** Cross-field: the new password must differ from the current one. */
export const differFrom = (current: string, next: string): ValidatorFn => (g) => {
  const x = g.get(current), y = g.get(next); if (!x || !y) return null;
  withExtraError(y, 'same', !!y.value && x.value === y.value);
  return null;
};
/** Cross-field: source and destination must differ. */
export const differentStations: ValidatorFn = (g) => {
  const f = g.get('from')?.value, t = g.get('to')?.value;
  return f && t && typeof f === 'object' && typeof t === 'object' && f.id === t.id ? { sameStation: true } : null;
};
/** The autocomplete control must hold a selected station object, not free text. */
export const stationSelected: ValidatorFn = (c) => (c.value && typeof c.value === 'object' && 'id' in c.value ? null : c.value ? { notSelected: true } : null);
/** Async: debounced uniqueness check against the backend. */
export const uniqueAsync = (check: (v: string) => Observable<boolean>, ms = 400): AsyncValidatorFn => (c) => {
  if (!c.value) return of(null);
  return timer(ms).pipe(switchMap(() => check(c.value)), map((taken) => (taken ? { taken: true } : null)));
};
export const timeHHmm: ValidatorFn = (c) => (!c.value || /^([01]\d|2[0-3]):[0-5]\d$/.test(c.value) ? null : { time: true });
/** Surface API field errors against the matching form controls. */
export function applyServerErrors(form: AbstractControl, fields?: Record<string, string>) {
  if (!fields) return;
  for (const [path, message] of Object.entries(fields)) {
    const ctrl = form.get(path.split('.').filter((x) => x !== ''));
    ctrl?.setErrors({ ...(ctrl.errors ?? {}), server: message }); ctrl?.markAsTouched();
  }
}
