import { Alert, Button, Paper, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { FormTextField } from '@/components/forms/fields';
import { ManagerSelect } from '@/components/forms/ManagerSelect';
import {
  useCreateDepartmentMutation,
  useGetDepartmentQuery,
  useUpdateDepartmentMutation,
} from '@/store/api/emsApi';
import { departmentSchema, type DepartmentFormValues } from '@/schemas/organization';
import { useNotify } from '@/contexts/NotificationContext';
import { errorMessage, fieldErrors, isApiError } from '@/api/errors';
import { toId } from '@/utils/format';

export default function DepartmentFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : undefined;
  const { data, isLoading, isError, error } = useGetDepartmentQuery(editId ?? 0, { skip: !editId });
  if (editId && isLoading) return <Loading page />;
  if (editId && (isError || !data)) return <ErrorMessage message={errorMessage(error)} />;
  const initial: DepartmentFormValues = data
    ? {
        code: data.code,
        name: data.name,
        description: data.description ?? '',
        headEmployeeId: data.headEmployeeId ? String(data.headEmployeeId) : '',
      }
    : { code: '', name: '', description: '', headEmployeeId: '' };
  return <DepartmentForm key={editId ?? 'new'} editId={editId} initial={initial} />;
}

function DepartmentForm({ editId, initial }: { editId?: number; initial: DepartmentFormValues }) {
  const navigate = useNavigate();
  const notify = useNotify();
  const [create] = useCreateDepartmentMutation();
  const [update] = useUpdateDepartmentMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const methods = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: initial,
    mode: 'onTouched',
  });

  // `watch(callback)` subscribes to value changes WITHOUT re-rendering this component: department codes are upper-case by rule,
  // so the field is normalised as the user types.
  const { watch, setValue } = methods;
  useEffect(() => {
    const sub = watch((values, { name }) => {
      if (name === 'code' && values.code && values.code !== values.code.toUpperCase())
        setValue('code', values.code.toUpperCase());
    });
    return () => sub.unsubscribe();
  }, [watch, setValue]);

  const submit = methods.handleSubmit(async (v) => {
    setServerError(null);
    const body = {
      code: v.code.toUpperCase(),
      name: v.name,
      description: v.description || undefined,
      headEmployeeId: toId(v.headEmployeeId) ?? (editId ? null : undefined),
    };
    try {
      const saved = editId ? await update({ id: editId, body }).unwrap() : await create(body).unwrap();
      notify.success(editId ? 'Department updated' : 'Department created');
      navigate(`/departments/${saved.id}`, { replace: true });
    } catch (e) {
      const errs = fieldErrors(e);
      Object.entries(errs).forEach(([f, m]) => {
        if (f in methods.getValues())
          methods.setError(f as keyof DepartmentFormValues, { type: 'server', message: m });
      });
      if (isApiError(e) && e.status === 409) methods.setError('code', { type: 'server', message: e.message });
      else if (Object.keys(errs).length === 0) setServerError(errorMessage(e));
    }
  });

  return (
    <FormProvider {...methods}>
      <PageHeader title={editId ? 'Edit department' : 'New department'} />
      <Paper component="form" onSubmit={submit} noValidate sx={{ p: 3, maxWidth: 640 }}>
        <Stack spacing={2}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <FormTextField<DepartmentFormValues>
            name="code"
            label="Code"
            helperText="A-Z, 0-9, _ or -"
            required
          />
          <FormTextField<DepartmentFormValues> name="name" label="Name" required />
          <FormTextField<DepartmentFormValues> name="description" label="Description" multiline rows={3} />
          <ManagerSelect<DepartmentFormValues> name="headEmployeeId" label="Department head" />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={methods.formState.isSubmitting}>
              {editId ? 'Save changes' : 'Create department'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </FormProvider>
  );
}
