import { Signal, computed, signal, WritableSignal } from '@angular/core';

/**
 * SIGNAL-BASED FORM STATE (Angular 19 has no official signal forms – they arrive in Angular 21 – so this is a small,
 * purpose-built implementation on top of signals). It is deliberately separate from the Reactive Forms used elsewhere.
 *   field values      : WritableSignal per field
 *   validation        : pure functions → `errors` computed signal (derived validation state)
 *   form state        : valid / dirty / touched are computed signals
 *   submission        : `submit(handler)` runs only when valid and tracks `submitting`
 */
export type Validator<T> = (value: T) => string | null;

export class SignalField<T> {
  readonly value: WritableSignal<T>;
  readonly touched = signal(false);
  private readonly initial: T;
  readonly error: Signal<string | null>;
  readonly dirty: Signal<boolean>;
  /** Error only shown after the field was touched (or after a submit attempt). */
  readonly visibleError: Signal<string | null>;

  constructor(initial: T, validators: readonly Validator<T>[] = [], private readonly submitted: Signal<boolean>) {
    this.initial = initial;
    this.value = signal(initial);
    this.error = computed(() => {
      const v = this.value();
      for (const fn of validators) { const e = fn(v); if (e) return e; }
      return null;
    });
    this.dirty = computed(() => this.value() !== this.initial);
    this.visibleError = computed(() => (this.touched() || this.submitted() ? this.error() : null));
  }
  set(v: T) { this.value.set(v); }
  blur() { this.touched.set(true); }
  reset() { this.value.set(this.initial); this.touched.set(false); }
}

export class SignalForm<S extends Record<string, unknown>> {
  private readonly _submitted = signal(false);
  readonly submitting = signal(false);
  readonly fields: { [K in keyof S]: SignalField<S[K]> };

  constructor(initial: S, validators: { [K in keyof S]?: readonly Validator<S[K]>[] } = {}) {
    const fields = {} as { [K in keyof S]: SignalField<S[K]> };
    for (const key of Object.keys(initial) as (keyof S)[]) fields[key] = new SignalField(initial[key], validators[key] ?? [], this._submitted);
    this.fields = fields;
  }
  private all(): SignalField<unknown>[] { return Object.values(this.fields) as SignalField<unknown>[]; }

  readonly values = computed(() => Object.fromEntries(Object.entries(this.fields).map(([k, f]) => [k, (f as SignalField<unknown>).value()])) as S);
  readonly errors = computed(() => Object.fromEntries(Object.entries(this.fields).map(([k, f]) => [k, (f as SignalField<unknown>).error()]).filter(([, e]) => e)) as Partial<Record<keyof S, string>>);
  readonly valid = computed(() => Object.keys(this.errors()).length === 0);
  readonly dirty = computed(() => this.all().some((f) => f.dirty()));

  submit<R>(handler: (values: S) => R): R | undefined {
    this._submitted.set(true);
    if (!this.valid()) return undefined;
    return handler(this.values());
  }
  reset() { this.all().forEach((f) => f.reset()); this._submitted.set(false); }
}

/** Reusable validator functions. */
export const required = (msg = 'Required'): Validator<string> => (v) => (v.trim() ? null : msg);
export const minNumber = (min: number, msg?: string): Validator<number> => (v) => (Number.isFinite(v) && v >= min ? null : msg ?? `Must be at least ${min}`);
export const emailFormat: Validator<string> = (v) => (/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v.trim()) ? null : 'Enter a valid e-mail address');
export const maxLength = (n: number): Validator<string> => (v) => (v.length <= n ? null : `At most ${n} characters`);
