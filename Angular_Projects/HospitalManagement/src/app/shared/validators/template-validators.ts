import { Directive, input } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';
import { phoneValidator } from './validators';

/** Custom validator for TEMPLATE-DRIVEN forms: `<input ngModel appPhone>` (registered through NG_VALIDATORS). */
@Directive({
  selector: '[appPhone]',
  standalone: true,
  providers: [{ provide: NG_VALIDATORS, useExisting: PhoneValidatorDirective, multi: true }],
})
export class PhoneValidatorDirective implements Validator {
  validate(control: AbstractControl): ValidationErrors | null { return phoneValidator(control); }
}

/** Parameterised template validator using a signal input: `<input ngModel [appForbidden]="['admin']">`. */
@Directive({
  selector: '[appForbidden]',
  standalone: true,
  providers: [{ provide: NG_VALIDATORS, useExisting: ForbiddenValuesDirective, multi: true }],
})
export class ForbiddenValuesDirective implements Validator {
  readonly appForbidden = input<readonly string[]>([]);
  validate(control: AbstractControl): ValidationErrors | null {
    const v = String(control.value ?? '').trim().toLowerCase();
    return v && this.appForbidden().some((f) => f.toLowerCase() === v) ? { forbidden: 'This value is not allowed' } : null;
  }
}
