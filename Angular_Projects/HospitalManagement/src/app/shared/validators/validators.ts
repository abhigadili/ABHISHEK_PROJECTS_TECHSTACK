import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';

/** Custom validators (Reactive Forms and the template-driven validator directive below). */
export const phoneValidator: ValidatorFn = (c) => (!c.value || /^\+?[0-9]{7,15}$/.test(String(c.value).trim()) ? null : { phone: 'Use 7-15 digits, optional leading +' });
export const pastDateValidator: ValidatorFn = (c) => {
  if (!c.value) return null;
  const d = new Date(c.value);
  return isNaN(d.getTime()) || d > new Date() ? { pastDate: 'Date cannot be in the future' } : null;
};
export const futureOrTodayValidator: ValidatorFn = (c) => {
  if (!c.value) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(c.value) < today ? { futureDate: 'Date cannot be in the past' } : null;
};
/** Backend rule: 8-72 chars with upper, lower and digit. */
export const strongPassword: ValidatorFn = (c) => {
  const v = String(c.value ?? '');
  if (!v) return null;
  return v.length >= 8 && v.length <= 72 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) ? null : { strongPassword: '8-72 characters with an uppercase letter, a lowercase letter and a digit' };
};
/** "500mg", "5 ml", "2 tablets" – a number followed by a unit. */
export const dosageValidator: ValidatorFn = (c) =>
  !c.value || /^\d+(\.\d+)?\s?(mg|g|mcg|µg|ml|l|iu|units?|tabs?|tablets?|caps?|capsules?|drops?|puffs?|%)(\s?\/\s?\w+)?$/i.test(String(c.value).trim()) ? null : { dosage: 'Use a number and unit, e.g. 500mg or 5 ml' };

/** Cross-field validator (FormGroup level): two controls must match. */
export const matchFields = (a: string, b: string, errorKey = 'mismatch'): ValidatorFn => (g: AbstractControl): ValidationErrors | null => {
  const x = g.get(a)?.value, y = g.get(b)?.value;
  return x && y && x !== y ? { [errorKey]: true } : null;
};
/** Cross-field validator: end time must be after start time. */
export const timeOrder = (start: string, end: string): ValidatorFn => (g) => {
  const s = g.get(start)?.value as string, e = g.get(end)?.value as string;
  return s && e && e <= s ? { timeOrder: 'End must be after start' } : null;
};
/** Conditional validation: apply `validator` to `control` only while `predicate()` is true (call updateValueAndValidity when the condition changes). */
export const requiredIf = (predicate: () => boolean): ValidatorFn => (c) => (predicate() && (c.value === null || c.value === undefined || String(c.value).trim() === '') ? { required: true } : null);

/**
 * ASYNC validator factory: the value must exist in a server-side catalogue. Debounced with timer() so a request is only
 * sent after the user pauses; switchMap cancels the previous check; failures never block the form (catchError → null).
 * Used by the prescription form: the medicine must be in the pharmacy inventory (real GET /pharmacy/medicines data).
 */
export const existsInCatalogue = (names$: () => Observable<readonly string[]>, key = 'notInInventory'): AsyncValidatorFn => (c) => {
  const v = String(c.value ?? '').trim().toLowerCase();
  if (!v) return of(null);
  return timer(350).pipe(
    switchMap(() => names$()),
    map((names) => (names.some((n) => n.toLowerCase().includes(v)) ? null : { [key]: `"${c.value}" is not in the pharmacy inventory` })),
    catchError(() => of(null)),
  );
};
