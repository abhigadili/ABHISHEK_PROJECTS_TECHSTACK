import { Alert, Avatar, Box, Button, Link, Stack, Typography } from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { FileUpload, type FileUploadHandle } from '@/components/common/FileUpload';
import { FormSelect, FormTextField } from '@/components/forms/fields';
import { Loading } from '@/components/common/Feedback';
import { useApi } from '@/hooks/useApi';
import { authApi } from '@/services/authApi';
import { createRegisterSchema, type RegisterValues } from '@/schemas/auth';
import { errorMessage, fieldErrors, isApiError } from '@/api/errors';
import { useNotify } from '@/contexts/NotificationContext';
import { humanize } from '@/utils/format';

type V = RegisterValues;
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].map((g) => ({
  value: g,
  label: humanize(g),
}));
const FIELDS: (keyof V)[] = [
  'firstName',
  'lastName',
  'username',
  'email',
  'mobile',
  'password',
  'dateOfBirth',
  'gender',
  'address',
  'departmentId',
  'designationId',
];

/** Public registration. Same stack as the rest of the app: React Hook Form + Zod (async username rule) + the shared Axios client. */
export default function RegisterPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const options = useApi((signal) => authApi.registrationOptions(signal), { immediate: true });
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const pickerRef = useRef<FileUploadHandle>(null);

  // backend-dependent uniqueness check, cached per username so re-validation on blur doesn't repeat the request
  const cache = useRef(new Map<string, boolean>());
  const isUsernameTaken = useCallback(async (username: string) => {
    const key = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(key)) return false; // format errors are reported by the sync rules
    const hit = cache.current.get(key);
    if (hit !== undefined) return hit;
    try {
      const taken = !(await authApi.usernameAvailable(key));
      cache.current.set(key, taken);
      return taken;
    } catch {
      return false; // never block the user on a lookup failure — the server re-checks on submit
    }
  }, []);
  const schema = useMemo(() => createRegisterSchema({ isUsernameTaken }), [isUsernameTaken]);

  const methods = useForm<V>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      dateOfBirth: '',
      gender: '',
      address: '',
      departmentId: '',
      designationId: '',
    },
  });
  const {
    handleSubmit,
    setError,
    setFocus,
    formState: { isSubmitting },
  } = methods;

  const onPicture = (file: File) => {
    setPicture(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  };
  const removePicture = () => {
    setPicture(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    pickerRef.current?.clear();
  };

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const form = new FormData();
    for (const k of FIELDS) {
      const val = v[k];
      if (val !== undefined && String(val).trim() !== '') form.append(k, String(val).trim());
    } // confirmPassword is never sent
    if (picture) form.append('file', picture);
    try {
      const res = await authApi.register(form);
      notify.success(res.message || 'Registration successful');
      navigate('/login', { replace: true, state: { registered: res.data.username } });
    } catch (e) {
      const errs = fieldErrors(e);
      let mapped = false;
      for (const [field, message] of Object.entries(errs)) {
        const name = (field === 'mobile' || FIELDS.includes(field as keyof V) ? field : null) as
          keyof V | null;
        if (name) {
          setError(name, { type: 'server', message });
          mapped = true;
        }
      }
      if (isApiError(e) && e.code === 'DUPLICATE_USERNAME')
        cache.current.set(methods.getValues('username').trim().toLowerCase(), true);
      if (!mapped) setFormError(errorMessage(e));
      const first = Object.keys(errs).find((f) => FIELDS.includes(f as keyof V));
      if (first) setFocus(first as keyof V); // do NOT re-validate here: that would wipe the server messages just set
    }
  });

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register to get access to the Employee Management System."
      wide
    >
      {options.loading ? (
        <Loading />
      ) : (
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} noValidate aria-label="Registration form">
            <Stack spacing={2}>
              {formError && (
                <Alert severity="error" role="alert">
                  {formError}
                </Alert>
              )}
              {options.error && (
                <Alert severity="warning">
                  Departments and designations could not be loaded; you can still register and HR will assign
                  them.
                </Alert>
              )}
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <FormTextField<V> name="firstName" label="First name" required />
                <FormTextField<V> name="lastName" label="Last name" required />
                <FormTextField<V>
                  name="username"
                  label="Username"
                  required
                  helperText="3–30 characters; checked for availability"
                  slotProps={{ htmlInput: { autoComplete: 'username', autoCapitalize: 'none' } }}
                />
                <FormTextField<V> name="email" label="Email address" type="email" required />
                <FormTextField<V> name="mobile" label="Mobile number" required placeholder="+1 555 0100" />
                <FormTextField<V> name="dateOfBirth" label="Date of birth" type="date" required />
                <FormSelect<V> name="gender" label="Gender" options={GENDERS} emptyLabel="Select…" required />
                <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
                <FormTextField<V>
                  name="password"
                  label="Password"
                  type="password"
                  required
                  helperText="10+ characters with upper, lower, digit and symbol"
                  slotProps={{ htmlInput: { autoComplete: 'new-password' } }}
                />
                <FormTextField<V>
                  name="confirmPassword"
                  label="Confirm password"
                  type="password"
                  required
                  slotProps={{ htmlInput: { autoComplete: 'new-password' } }}
                />
              </Box>
              <FormTextField<V> name="address" label="Address" multiline rows={2} />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <FormSelect<V>
                  name="departmentId"
                  label="Department (optional)"
                  options={(options.data?.departments ?? []).map((d) => ({
                    value: String(d.id),
                    label: d.name,
                  }))}
                  emptyLabel="Not sure yet"
                />
                <FormSelect<V>
                  name="designationId"
                  label="Designation (optional)"
                  options={(options.data?.designations ?? []).map((d) => ({
                    value: String(d.id),
                    label: d.name,
                  }))}
                  emptyLabel="Not sure yet"
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Profile picture (optional)
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  {preview && (
                    <Avatar
                      src={preview}
                      alt="Selected profile picture preview"
                      sx={{ width: 56, height: 56 }}
                    />
                  )}
                  <FileUpload
                    ref={pickerRef}
                    accept="image/jpeg,image/png,image/webp"
                    maxBytes={2 * 1024 * 1024}
                    label={picture ? 'Change picture' : 'Choose picture'}
                    onFile={onPicture}
                    disabled={isSubmitting}
                  />
                  {picture && (
                    <Button size="small" color="inherit" onClick={removePicture}>
                      Remove
                    </Button>
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  JPEG, PNG or WebP, up to 2 MB.
                </Typography>
              </Box>
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
              <Link component={RouterLink} to="/login" variant="body2" textAlign="center">
                Already registered? Sign in
              </Link>
            </Stack>
          </form>
        </FormProvider>
      )}
    </AuthShell>
  );
}
