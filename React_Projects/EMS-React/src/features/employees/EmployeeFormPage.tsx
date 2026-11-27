import { Alert, Box, Button, Chip, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { FormCheckbox, FormSelect, FormTextField } from '@/components/forms/fields';
import { ManagerSelect } from '@/components/forms/ManagerSelect';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import {
  useCreateEmployeeMutation,
  useGetEmployeeQuery,
  useUpdateEmployeeMutation,
} from '@/store/api/emsApi';
import { useDepartments, useDesignations } from '@/hooks/useDepartments';
import { useFormValidation } from '@/hooks/useFormValidation';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { employeeSchema, type EmployeeFormValues } from '@/schemas/employee';
import { errorMessage, fieldErrors, isApiError } from '@/api/errors';
import { qualificationsStore } from '@/services/qualificationsStore';
import {
  EducationSection,
  EmergencyContactsSection,
  ExperienceSection,
  SkillsSection,
} from './form/FieldArraySections';
import { emptyEmployeeForm, toFormValues, toPayload, toQualifications } from './form/formMapping';
import { humanize } from '@/utils/format';
import { ROLES } from '@/constants/roles';

type V = EmployeeFormValues;

/** Fields validated when the user presses "Next" on each step (`trigger`) — so errors surface step by step, not all at the end. */
const STEPS: { label: string; fields: (keyof V)[] }[] = [
  {
    label: 'Personal & contact',
    fields: [
      'firstName',
      'middleName',
      'lastName',
      'dateOfBirth',
      'workEmail',
      'personalEmail',
      'phone',
      'addressLine',
      'city',
      'state',
      'country',
      'postalCode',
    ],
  },
  {
    label: 'Job',
    fields: [
      'employeeCode',
      'employmentType',
      'departmentId',
      'designationId',
      'managerId',
      'jobTitle',
      'workLocation',
      'joiningDate',
      'probationEndDate',
      'salary',
      'salaryCurrency',
    ],
  },
  { label: 'Emergency & education', fields: ['emergencyContacts', 'education'] },
  { label: 'Experience & skills', fields: ['experience', 'skills', 'certifications'] },
  { label: 'Login & review', fields: ['createAccount', 'role', 'password', 'confirmPassword'] },
];

export default function EmployeeFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : undefined;
  const mode = editId ? 'edit' : 'create';
  const { data: existing, isLoading, isError, error } = useGetEmployeeQuery(editId ?? 0, { skip: !editId });
  if (editId && isLoading) return <Loading page />;
  if (editId && (isError || !existing)) return <ErrorMessage message={errorMessage(error)} />;
  // `key` forces a fresh form (and fresh defaultValues) when switching between employees
  return (
    <EmployeeForm
      key={editId ?? 'new'}
      mode={mode}
      editId={editId}
      initial={existing ? toFormValues(existing, qualificationsStore.load(existing.id)) : emptyEmployeeForm()}
    />
  );
}

function EmployeeForm({ mode, editId, initial }: { mode: 'create' | 'edit'; editId?: number; initial: V }) {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();
  const { can } = usePermissions();
  const { options: deptOptions } = useDepartments({ activeOnly: true });
  const { options: desigOptions } = useDesignations();
  const [createEmployee] = useCreateEmployeeMutation();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  // async (backend-dependent) duplicate-email rule only on create; edit uses the plain schema
  const { schema: asyncSchema, forgetEmail } = useFormValidation({ exceptEmployeeId: editId });
  const schema = mode === 'create' ? asyncSchema : employeeSchema;

  const methods = useForm<V>({ resolver: zodResolver(schema), defaultValues: initial, mode: 'onTouched' });
  const {
    handleSubmit,
    trigger,
    setError,
    clearErrors,
    getValues,
    setValue,
    resetField,
    formState: { isDirty, isSubmitting, dirtyFields, errors },
  } = methods;

  // `useWatch` subscribes ONLY this component to these fields (fine-grained re-render) — `watch()` would re-render on every keystroke
  const createAccount = useWatch({ control: methods.control, name: 'createAccount' });
  const departmentId = useWatch({ control: methods.control, name: 'departmentId' });
  const designationId = useWatch({ control: methods.control, name: 'designationId' });
  const selectedDepartment = deptOptions.find((o) => o.value === departmentId);
  const firstFocus = useRef<HTMLFormElement>(null);

  // conditional field: switching the login off wipes the password fields (resetField restores default + clears dirty/touched/error)
  useEffect(() => {
    if (!createAccount) {
      resetField('password');
      resetField('confirmPassword');
      clearErrors(['password', 'confirmPassword']);
    }
  }, [createAccount, resetField, clearErrors]);

  // convenience: choosing a designation pre-fills an EMPTY job title (setValue marks it dirty so it is saved)
  useEffect(() => {
    const d = desigOptions.find((o) => o.value === designationId);
    if (d && !getValues('jobTitle'))
      setValue('jobTitle', d.label.replace(/ \(L\d+\)$/, ''), { shouldDirty: true });
  }, [designationId, desigOptions, getValues, setValue]);

  // leaving with unsaved edits asks first (data-router navigation blocker).
  // `done` is a ref, not form state: `isSubmitSuccessful` only flips AFTER handleSubmit resolves, i.e. after we call navigate().
  const done = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !done.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: 'Discard changes?',
      message: 'You have unsaved changes that will be lost.',
      confirmLabel: 'Discard',
      destructive: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  const next = async () => {
    const valid = await trigger(STEPS[step].fields as never); // validate just this step
    if (valid) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      firstFocus.current?.scrollIntoView({ block: 'start' });
    }
  };

  const stepHasError = (i: number) => STEPS[i].fields.some((f) => errors[f]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const body = toPayload(values, mode, can('employee:view-compensation'));
      const saved =
        mode === 'create'
          ? await createEmployee(body).unwrap()
          : await updateEmployee({ id: editId!, body }).unwrap();
      qualificationsStore.save(saved.id, toQualifications(values)); // sections the backend can't store yet
      notify.success(mode === 'create' ? 'Employee created' : 'Employee updated');
      done.current = true;
      navigate(`/employees/${saved.id}`, { replace: true });
    } catch (e) {
      // map server-side validation back onto the right inputs; the server stays the final authority
      const errs = fieldErrors(e);
      const fieldNames = Object.keys(getValues());
      let mapped = false;
      for (const [field, message] of Object.entries(errs)) {
        const name = (
          field === 'account.password' ? 'password' : field === 'account.role' ? 'role' : field
        ) as keyof V;
        if (fieldNames.includes(name)) {
          setError(name, { type: 'server', message });
          mapped = true;
        }
      }
      if (isApiError(e) && e.status === 409) {
        setError('workEmail', { type: 'server', message: e.message });
        forgetEmail(getValues('workEmail'));
        mapped = true;
      }
      if (!mapped) setFormError(errorMessage(e));
      const firstBad = STEPS.findIndex((s) =>
        s.fields.some((f) => f in errs || (f === 'workEmail' && isApiError(e) && e.status === 409)),
      );
      if (firstBad >= 0) setStep(firstBad);
    }
  });

  const last = step === STEPS.length - 1;
  const dirtyCount = useMemo(() => Object.keys(dirtyFields).length, [dirtyFields]);

  return (
    <FormProvider {...methods}>
      <PageHeader
        title={mode === 'create' ? 'New employee' : 'Edit employee'}
        subtitle={
          mode === 'create'
            ? 'Add a person to the company directory'
            : `Editing ${initial.firstName} ${initial.lastName}`
        }
        actions={
          isDirty ? (
            <Chip
              color="warning"
              size="small"
              label={`Unsaved changes (${dirtyCount} field${dirtyCount === 1 ? '' : 's'})`}
            />
          ) : undefined
        }
      />
      <Stepper
        activeStep={step}
        alternativeLabel
        sx={{ mb: 3, display: { xs: 'none', md: 'flex' } }}
        nonLinear
      >
        {STEPS.map((s, i) => (
          <Step key={s.label} completed={i < step}>
            <StepLabel error={stepHasError(i)} onClick={() => setStep(i)} sx={{ cursor: 'pointer' }}>
              {s.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      <Typography variant="overline" sx={{ display: { md: 'none' } }}>
        Step {step + 1} of {STEPS.length} · {STEPS[step].label}
      </Typography>
      <Paper component="form" ref={firstFocus} onSubmit={onSubmit} noValidate sx={{ p: { xs: 2, md: 3 } }}>
        {formError && (
          <Alert severity="error" role="alert" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        <Box hidden={step !== 0}>
          <Typography variant="h6" gutterBottom>
            Personal details
          </Typography>
          <Box
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, mb: 3 }}
          >
            <FormTextField<V> name="firstName" label="First name" required />
            <FormTextField<V> name="middleName" label="Middle name" />
            <FormTextField<V> name="lastName" label="Last name" required />
            <FormTextField<V> name="dateOfBirth" label="Date of birth" type="date" />
          </Box>
          <Typography variant="h6" gutterBottom>
            Contact
          </Typography>
          <Box
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, mb: 3 }}
          >
            <FormTextField<V>
              name="workEmail"
              label="Work email"
              type="email"
              required
              helperText={mode === 'create' ? 'Checked against existing employees' : undefined}
            />
            <FormTextField<V> name="personalEmail" label="Personal email" type="email" />
            <FormTextField<V> name="phone" label="Phone" placeholder="+1 555 0100" />
          </Box>
          <Typography variant="h6" gutterBottom>
            Address
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <FormTextField<V> name="addressLine" label="Street address" />
            </Box>
            <FormTextField<V> name="city" label="City" />
            <FormTextField<V> name="state" label="State / region" />
            <FormTextField<V> name="postalCode" label="Postal code" />
            <FormTextField<V> name="country" label="Country" />
          </Box>
        </Box>
        <Box hidden={step !== 1}>
          <Typography variant="h6" gutterBottom>
            Job
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {mode === 'create' && (
              <FormTextField<V>
                name="employeeCode"
                label="Employee code"
                helperText="Leave blank to auto-generate"
              />
            )}
            <FormSelect<V>
              name="employmentType"
              label="Employment type"
              options={['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((v) => ({
                value: v,
                label: humanize(v),
              }))}
            />
            <FormSelect<V>
              name="departmentId"
              label="Department"
              options={deptOptions}
              emptyLabel="No department"
            />
            <FormSelect<V>
              name="designationId"
              label="Designation"
              options={desigOptions}
              emptyLabel="No designation"
            />
            <ManagerSelect<V> name="managerId" excludeId={editId} />
            <FormTextField<V> name="jobTitle" label="Job title" />
            <FormTextField<V> name="workLocation" label="Work location" />
            <FormTextField<V> name="joiningDate" label="Joining date" type="date" required />
            <FormTextField<V> name="probationEndDate" label="Probation ends" type="date" />
            {can('employee:view-compensation') && (
              <>
                <FormTextField<V> name="salary" label="Salary (annual)" type="number" />
                <FormTextField<V> name="salaryCurrency" label="Currency" helperText="ISO code, e.g. USD" />
              </>
            )}
          </Box>
          {selectedDepartment && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Department: {selectedDepartment.label}
            </Typography>
          )}
        </Box>
        <Box hidden={step !== 2}>
          <Stack spacing={3}>
            <EmergencyContactsSection />
            <EducationSection />
          </Stack>
        </Box>
        <Box hidden={step !== 3}>
          <Stack spacing={3}>
            <ExperienceSection />
            <SkillsSection />
          </Stack>
        </Box>
        <Box hidden={step !== 4}>
          {mode === 'create' ? (
            <Stack spacing={2}>
              <Typography variant="h6">Login account</Typography>
              <FormCheckbox<V> name="createAccount" label="Create a login so this person can sign in" />
              {createAccount && (
                <Box
                  sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}
                >
                  <FormSelect<V>
                    name="role"
                    label="Role"
                    options={ROLES.map((r) => ({ value: r, label: humanize(r) }))}
                  />
                  <FormTextField<V>
                    name="password"
                    label="Initial password"
                    type="password"
                    helperText="10+ chars with upper, lower, digit and symbol"
                  />
                  <FormTextField<V> name="confirmPassword" label="Confirm password" type="password" />
                </Box>
              )}
            </Stack>
          ) : (
            <Typography color="text.secondary">Login and role are managed from “Users & roles”.</Typography>
          )}
          <Alert severity="info" sx={{ mt: 3 }}>
            Education, experience, skills, certifications and extra emergency contacts are stored in this
            browser only — the backend has no endpoint for them yet.
          </Alert>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 3 }}>
          <Button onClick={() => navigate(-1)} color="inherit">
            Cancel
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {!last && (
              <Button variant="outlined" onClick={next}>
                Next
              </Button>
            )}
            {last && (
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create employee' : 'Save changes'}
              </Button>
            )}
            {!last && mode === 'edit' && (
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                Save changes
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </FormProvider>
  );
}
