import { fakeAsync, tick } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { toIsoDate } from '../utils/dates';
import { dateRange, errorMessage, futureOrToday, matchFields, numberRange, passwordComplexity, pastDate, phoneNumber, uniqueValue, usernameFormat, validateIf } from './validators';

describe('custom validators', () => {
  describe('passwordComplexity', () => {
    const v = passwordComplexity();
    it('accepts a strong password', () => expect(v(new FormControl('Str0ng-Passw0rd!'))).toBeNull());
    it('lists every missing rule', () => {
      const err = v(new FormControl('abc'))!;
      expect(err['passwordComplexity'].missing).toEqual(['at least 10 characters', 'an uppercase letter', 'a digit', 'a special character']);
    });
    it('ignores empty values (use Validators.required for presence)', () => expect(v(new FormControl(''))).toBeNull());
    it('rejects > 72 chars', () => expect(v(new FormControl('Aa1!'.repeat(19)))!['passwordComplexity'].missing).toContain('at most 72 characters'));
  });

  describe('matchFields', () => {
    const build = (a: string, b: string) => new FormGroup({ pw: new FormControl(a), confirm: new FormControl(b) }, { validators: matchFields('pw', 'confirm') });
    it('is valid when equal', () => expect(build('x', 'x').valid).toBeTrue());
    it('flags the group AND the confirm control on mismatch', () => {
      const g = build('x', 'y');
      expect(g.hasError('mismatch')).toBeTrue();
      expect(g.controls['confirm'].hasError('mismatch')).toBeTrue();
    });
    it('clears the control error once they match again', () => {
      const g = build('x', 'y');
      g.controls['confirm'].setValue('x');
      expect(g.controls['confirm'].hasError('mismatch')).toBeFalse();
      expect(g.valid).toBeTrue();
    });
  });

  describe('phoneNumber', () => {
    const v = phoneNumber();
    it('accepts international formats', () => {
      for (const p of ['+1 555 010 2000', '555 (010) 2000', '5550102000']) expect(v(new FormControl(p))).withContext(p).toBeNull();
    });
    it('rejects letters and too-short values', () => {
      for (const p of ['abc', '12', '555-CALL-ME']) expect(v(new FormControl(p))).withContext(p).toEqual({ phone: true });
    });
    it('allows empty (optional field)', () => expect(v(new FormControl(''))).toBeNull());
  });

  describe('dateRange / numberRange', () => {
    const range = (s: string, e: string) => new FormGroup({ s: new FormControl(s), e: new FormControl(e) }, { validators: dateRange('s', 'e') });
    it('accepts start <= end and same day', () => {
      expect(range('2026-01-01', '2026-01-31').valid).toBeTrue();
      expect(range('2026-01-01', '2026-01-01').valid).toBeTrue();
    });
    it('rejects end before start', () => expect(range('2026-02-01', '2026-01-31').hasError('dateRange')).toBeTrue());
    it('ignores a missing side', () => expect(range('2026-02-01', '').valid).toBeTrue());
    it('numberRange rejects end year before start year', () => {
      const g = new FormGroup({ a: new FormControl(2020), b: new FormControl(2019) }, { validators: numberRange('a', 'b') });
      expect(g.hasError('numberRange')).toBeTrue();
    });
  });

  describe('pastDate / futureOrToday', () => {
    const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return toIsoDate(d); };
    it('pastDate: yesterday ok, today and tomorrow rejected', () => {
      expect(pastDate()(new FormControl(day(-1)))).toBeNull();
      expect(pastDate()(new FormControl(day(1)))).toEqual({ pastDate: true });
    });
    it('futureOrToday: tomorrow ok, last week rejected', () => {
      expect(futureOrToday()(new FormControl(day(1)))).toBeNull();
      expect(futureOrToday()(new FormControl(day(-7)))).toEqual({ notInPast: true });
    });
  });

  describe('validateIf (conditional)', () => {
    it('applies the inner validator only while the condition holds', () => {
      const g = new FormGroup({ on: new FormControl(false), value: new FormControl('') });
      g.controls['value'].addValidators(validateIf((p) => !!p.get('on')?.value, Validators.required));
      g.controls['value'].updateValueAndValidity();
      expect(g.controls['value'].valid).toBeTrue();
      g.controls['on'].setValue(true);
      g.controls['value'].updateValueAndValidity();
      expect(g.controls['value'].hasError('required')).toBeTrue();
    });
  });

  describe('uniqueValue (async)', () => {
    it('debounces, then reports { taken } when the backend says the value exists', fakeAsync(() => {
      const exists = jasmine.createSpy('exists').and.returnValue(of(true));
      const c = new FormControl('eve@ems.test', { asyncValidators: [uniqueValue(exists, 'taken', 300)] });
      expect(c.pending).toBeTrue();
      tick(299);
      expect(exists).not.toHaveBeenCalled();
      tick(1);
      expect(exists).toHaveBeenCalledOnceWith('eve@ems.test');
      expect(c.errors).toEqual({ taken: true });
    }));

    it('is valid when the value is free, and does not call the backend for invalid e-mails', fakeAsync(() => {
      const exists = jasmine.createSpy('exists').and.returnValue(of(false));
      const c = new FormControl('free@ems.test', { asyncValidators: [uniqueValue(exists, 'taken', 10)] });
      tick(10);
      expect(c.valid).toBeTrue();
      const bad = new FormControl('nope', { validators: [Validators.email], asyncValidators: [uniqueValue(exists, 'taken', 10)] });
      tick(10);
      expect(exists).toHaveBeenCalledTimes(1);
      expect(bad.hasError('email')).toBeTrue();
    }));

    it('never blocks the form when the lookup itself fails (backend validates on submit)', fakeAsync(() => {
      const c = new FormControl('x@y.z', { asyncValidators: [uniqueValue(() => throwError(() => new Error('down')), 'taken', 1)] });
      tick(1);
      expect(c.valid).toBeTrue();
    }));

    it('switchMap semantics: a newer value cancels the older lookup', fakeAsync(() => {
      const exists = jasmine.createSpy('exists').and.callFake((v: string) => of(v === 'a@b.co'));
      const c = new FormControl('a@b.co', { asyncValidators: [uniqueValue(exists, 'taken', 100)] });
      tick(50);
      c.setValue('c@d.co');
      tick(100);
      expect(exists).toHaveBeenCalledTimes(1);
      expect(exists).toHaveBeenCalledWith('c@d.co');
      expect(c.valid).toBeTrue();
    }));
  });

  describe('errorMessage', () => {
    it('produces readable text for each validation key', () => {
      const c = new FormControl('', Validators.required);
      expect(errorMessage(c, 'Name')).toBe('Name is required');
      c.setValue('ab');
      c.setValidators(Validators.minLength(5));
      c.updateValueAndValidity();
      expect(errorMessage(c, 'Name')).toBe('Name must be at least 5 characters');
      c.setErrors({ server: 'Work email already in use' });
      expect(errorMessage(c)).toBe('Work email already in use');
      expect(errorMessage(new FormControl('ok'))).toBe('');
    });
  });

  describe('usernameFormat', () => {
    it('mirrors the backend username rule', () => {
      const v = usernameFormat();
      for (const ok of ['rita', 'rita.reg', 'a_b-c', 'User123', 'abc']) expect(v(new FormControl(ok))).withContext(ok).toBeNull();
      for (const bad of ['ab', 'a@b.co', 'bad name', '-lead', 'x'.repeat(31)]) expect(v(new FormControl(bad))).withContext(bad).toEqual({ username: true });
      expect(v(new FormControl(''))).toBeNull(); // required is a separate validator
    });
    it('username messages', () => {
      const c = new FormControl('x'); c.setErrors({ usernameTaken: true });
      expect(errorMessage(c)).toBe('This username is already taken');
      c.setErrors({ username: true });
      expect(errorMessage(c)).toContain('Letters, digits');
    });
  });
});
