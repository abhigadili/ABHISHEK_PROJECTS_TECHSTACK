import { TestBed } from '@angular/core/testing';
import { FormArray, NonNullableFormBuilder } from '@angular/forms';
import { educationGroup, experienceGroup, skillControl } from './employee-form.factory';

describe('employee form factory — FormArray / FormBuilder behaviour', () => {
  let fb: NonNullableFormBuilder;
  beforeEach(() => (fb = TestBed.inject(NonNullableFormBuilder)));

  describe('education rows', () => {
    it('requires institution and degree, independently per row', () => {
      const rows = new FormArray([educationGroup(fb), educationGroup(fb, { institution: 'MIT', degree: 'BSc' })]);
      expect(rows.at(0).controls.institution.hasError('required')).toBeTrue();
      expect(rows.at(1).valid).toBeTrue();
      expect(rows.valid).toBeFalse();
      rows.removeAt(0);
      expect(rows.valid).toBeTrue();
      expect(rows.length).toBe(1);
    });

    it('rejects end year before start year (group validator) and out-of-range years (control validators)', () => {
      const g = educationGroup(fb, { institution: 'X', degree: 'Y', startYear: 2020, endYear: 2018 });
      expect(g.hasError('numberRange')).toBeTrue();
      g.patchValue({ endYear: 2022 });
      expect(g.valid).toBeTrue();
      g.patchValue({ startYear: 1900 });
      expect(g.controls.startYear.hasError('min')).toBeTrue();
    });

    it('getRawValue returns typed values for every row', () => {
      const rows = fb.array([educationGroup(fb, { institution: 'A', degree: 'B', startYear: 2010, endYear: 2014 })]);
      expect(rows.getRawValue()[0]).toEqual({ institution: 'A', degree: 'B', fieldOfStudy: '', startYear: 2010, endYear: 2014, grade: '' });
    });
  });

  describe('experience rows (conditional validation + enable/disable)', () => {
    it('requires an end date only when the job has ended', () => {
      const g = experienceGroup(fb, { company: 'Acme', role: 'Dev', startDate: '2020-01-01' });
      expect(g.controls.endDate.hasError('required')).toBeTrue();
      g.controls.currentlyWorking.setValue(true);
      expect(g.controls.endDate.disabled).toBeTrue();
      expect(g.valid).toBeTrue();
      g.controls.currentlyWorking.setValue(false);
      expect(g.controls.endDate.enabled).toBeTrue();
      expect(g.controls.endDate.hasError('required')).toBeTrue();
    });

    it('validates the date range as a form-level rule', () => {
      const g = experienceGroup(fb, { company: 'A', role: 'B', startDate: '2022-05-01', endDate: '2021-01-01' });
      expect(g.hasError('dateRange')).toBeTrue();
      g.controls.endDate.setValue('2023-01-01');
      expect(g.valid).toBeTrue();
    });

    it('a pre-filled current job starts with the end date disabled', () => {
      const g = experienceGroup(fb, { company: 'A', role: 'B', startDate: '2022-01-01', currentlyWorking: true });
      expect(g.controls.endDate.disabled).toBeTrue();
      // disabled controls are excluded from .value but present in getRawValue()
      expect('endDate' in g.value).toBeFalse();
      expect('endDate' in g.getRawValue()).toBeTrue();
    });
  });

  describe('skills', () => {
    it('each skill is validated on its own', () => {
      const skills = new FormArray([skillControl(fb, 'TypeScript'), skillControl(fb, ''), skillControl(fb, 'x')]);
      expect(skills.at(0).valid).toBeTrue();
      expect(skills.at(1).hasError('required')).toBeTrue();
      expect(skills.at(2).hasError('minlength')).toBeTrue();
    });
  });

  it('dirty/pristine and touched/untouched propagate from rows to the array', () => {
    const rows = new FormArray([educationGroup(fb)]);
    expect(rows.pristine).toBeTrue();
    rows.at(0).controls.institution.setValue('MIT');
    rows.at(0).controls.institution.markAsDirty();
    expect(rows.dirty).toBeTrue();
    rows.at(0).controls.degree.markAsTouched();
    expect(rows.touched).toBeTrue();
    rows.reset();
    expect(rows.pristine).toBeTrue();
    expect(rows.untouched).toBeTrue();
  });
});
