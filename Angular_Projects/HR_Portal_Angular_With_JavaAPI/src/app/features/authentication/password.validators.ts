import { AbstractControl, ValidationErrors } from '@angular/forms';
/** Mirrors the backend @StrongPassword rule: 10-72 chars, upper + lower + digit + symbol, no whitespace. */
export const strongPassword = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '');
  return v.length >= 10 && v.length <= 72 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9\s]/.test(v) && /^\S+$/.test(v) ? null : { strong: true };
};
export const sameAs = (a: string, b: string) => (g: AbstractControl): ValidationErrors | null => (g.get(a)?.value === g.get(b)?.value ? null : { mismatch: true });
