import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * CUSTOM FORM CONTROL (ControlValueAccessor): `<app-quantity-stepper formControlName="quantity" />` works with Reactive AND template-driven
 * forms. writeValue ← model, onChange → model, onTouched on blur, setDisabledState from the control. Registered through NG_VALUE_ACCESSOR
 * (multi provider) with forwardRef because the class is referenced before it is defined.
 */
@Component({
  selector: 'app-quantity-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => QuantityStepperComponent), multi: true }],
  template: `
    <div class="d-inline-flex align-items-center w-100" role="group" [attr.aria-label]="label()">
      <button type="button" class="btn btn-outline-secondary" [disabled]="disabled() || value() <= min()" (click)="step(-1)" aria-label="Decrease">−</button>
      <input class="form-control text-center mx-1" type="number" inputmode="numeric" [value]="value()" [min]="min()" [max]="max()" [disabled]="disabled()" [attr.aria-label]="label()" (input)="set($any($event.target).valueAsNumber)" (blur)="touch()" />
      <button type="button" class="btn btn-outline-secondary" [disabled]="disabled() || value() >= max()" (click)="step(1)" aria-label="Increase">+</button>
    </div>`,
})
export class QuantityStepperComponent implements ControlValueAccessor {
  readonly label = input('Quantity');
  readonly min = input(1);
  readonly max = input(1000);
  protected readonly value = signal(1);
  protected readonly disabled = signal(false);
  private onChange: (v: number) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  writeValue(v: number | null): void { this.value.set(Number.isFinite(v as number) ? Number(v) : this.min()); }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }
  protected set(v: number): void { const n = Number.isFinite(v) ? v : this.min(); this.value.set(n); this.onChange(n); }
  protected step(d: number): void { this.set(Math.min(this.max(), Math.max(this.min(), this.value() + d))); this.touch(); }
  protected touch(): void { this.onTouched(); }
}
