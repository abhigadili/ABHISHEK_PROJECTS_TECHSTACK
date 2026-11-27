import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { EducationRecord, ExperienceRecord } from '../../core/models/employee.models';
import { dateRange, numberRange, phoneNumber, validateIf } from '../../shared/validators/validators';

/**
 * Builders for the dynamic FormArray rows of the employee form. Keeping them as pure functions (taking the
 * NonNullableFormBuilder) makes them unit-testable without rendering a component.
 */
export type EducationGroup = ReturnType<typeof educationGroup>;
export type ExperienceGroup = ReturnType<typeof experienceGroup>;
export type SkillControl = FormControl<string>;

const THIS_YEAR = new Date().getFullYear();

export function educationGroup(fb: NonNullableFormBuilder, v?: Partial<EducationRecord>) {
  return fb.group(
    {
      institution: [v?.institution ?? '', [Validators.required, Validators.maxLength(120)]],
      degree: [v?.degree ?? '', [Validators.required, Validators.maxLength(80)]],
      fieldOfStudy: [v?.fieldOfStudy ?? '', [Validators.maxLength(80)]],
      startYear: fb.control<number | null>(v?.startYear ?? null, [Validators.min(1950), Validators.max(THIS_YEAR)]),
      endYear: fb.control<number | null>(v?.endYear ?? null, [Validators.min(1950), Validators.max(THIS_YEAR + 8)]),
      grade: [v?.grade ?? '', [Validators.maxLength(30)]],
    },
    { validators: numberRange('startYear', 'endYear') },
  );
}

export function experienceGroup(fb: NonNullableFormBuilder, v?: Partial<ExperienceRecord>) {
  const group = fb.group(
    {
      company: [v?.company ?? '', [Validators.required, Validators.maxLength(120)]],
      role: [v?.role ?? '', [Validators.required, Validators.maxLength(80)]],
      startDate: [v?.startDate ?? '', [Validators.required]],
      endDate: fb.control<string | null>(v?.endDate ?? null),
      currentlyWorking: [v?.currentlyWorking ?? false],
      summary: [v?.summary ?? '', [Validators.maxLength(300)]],
    },
    { validators: dateRange('startDate', 'endDate') },
  );
  // Conditional validation: an end date is required only for jobs that have ended.
  group.controls.endDate.addValidators(validateIf((p) => !p.get('currentlyWorking')?.value, Validators.required));
  // Enable/disable: a current job has no end date.
  const sync = (current: boolean) => {
    if (current) group.controls.endDate.disable({ emitEvent: false });
    else group.controls.endDate.enable({ emitEvent: false });
    group.controls.endDate.updateValueAndValidity({ emitEvent: false });
  };
  sync(group.controls.currentlyWorking.value);
  group.controls.currentlyWorking.valueChanges.subscribe(sync);
  return group;
}

export const skillControl = (fb: NonNullableFormBuilder, v = ''): SkillControl =>
  fb.control(v, [Validators.required, Validators.minLength(2), Validators.maxLength(60)]);

export function addressGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    line: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(100)]],
    state: ['', [Validators.maxLength(100)]],
    country: ['', [Validators.maxLength(100)]],
    postalCode: ['', [Validators.maxLength(20)]],
  });
}

export function emergencyGroup(fb: NonNullableFormBuilder) {
  return fb.group({
    name: ['', [Validators.maxLength(120)]],
    phone: ['', [phoneNumber()]],
    relation: ['', [Validators.maxLength(50)]],
  });
}

export type EducationArray = FormArray<EducationGroup>;
export type ExperienceArray = FormArray<ExperienceGroup>;
export type SkillArray = FormArray<SkillControl>;
export type { FormGroup };
