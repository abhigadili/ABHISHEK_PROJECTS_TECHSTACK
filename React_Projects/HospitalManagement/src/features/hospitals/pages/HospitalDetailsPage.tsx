import { useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid2 as Grid, IconButton, List, ListItem, ListItemText, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import { useDeactivateHospital, useDeleteDepartment, useDepartments, useHospital, useSaveDepartment } from '../hooks/useHospitals';
import { validateDepartment } from '@/schemas/hospital';
import { useActiveHospital } from '@/contexts/HospitalContext';
import { useCan } from '@/contexts/AuthContext';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { DetailsGrid } from '@/features/doctors/components/DetailsGrid';
import { useDoctorList } from '@/features/doctors/hooks/useDoctors';
import { errorMessage, isApiError } from '@/services/axios/errors';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Department } from '@/types';
import toast from 'react-hot-toast';

type Section = 'overview' | 'departments' | 'facilities';

/** Hospital profile/details: Overview, Departments (full CRUD for admins) and Facilities. Section is routed via /hospitals/:id/:section. */
export default function HospitalDetailsPage({ section = 'overview' }: { section?: Section }) {
  const id = Number(useParams().hospitalId);
  const navigate = useNavigate();
  const canManage = useCan('hospitals:manage');
  const { activeHospitalId, setActiveHospitalId } = useActiveHospital();
  const query = useHospital(id);
  const deactivate = useDeactivateHospital();
  const confirm = useRef<ConfirmDialogHandle>(null);
  useDocumentTitle(query.data?.name ?? 'Hospital');
  const base = `/hospitals/${id}`;

  return (
    <QueryBoundary query={query}>
      {(h) => (
        <>
          <Card variant="outlined" sx={{ mb: 2 }}><CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center"><ApartmentRounded color="primary" sx={{ fontSize: 48 }} /><Box><Typography variant="h5" fontWeight={700}>{h.name}</Typography><Typography variant="body2" color="text.secondary">{[h.address, h.city].filter(Boolean).join(', ') || 'Address not recorded'}</Typography><Stack direction="row" spacing={1} sx={{ mt: 0.5 }}><Chip size="small" label={`Code ${h.code}`} variant="outlined" /><Chip size="small" label={h.active ? 'Active' : 'Inactive'} color={h.active ? 'success' : 'default'} />{activeHospitalId === h.id && <Chip size="small" color="primary" label="Working here" />}</Stack></Box></Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {activeHospitalId !== h.id && h.active && <Button variant="outlined" onClick={() => { setActiveHospitalId(h.id); toast.success(`Now working at ${h.name}`); }}>Set as active</Button>}
                {canManage && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => navigate(`${base}/edit`)}>Edit</Button>}
                {canManage && h.active && <Button color="error" variant="outlined" onClick={() => confirm.current?.ask({ title: 'Deactivate hospital?', message: 'Doctors and departments stay in the system but the hospital is hidden from new selections.', destructive: true, confirmLabel: 'Deactivate', onConfirm: () => deactivate.mutateAsync(h.id).then(() => undefined) })}>Deactivate</Button>}
              </Stack>
            </Stack>
          </CardContent></Card>
          <Tabs value={section} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }} aria-label="Hospital sections">
            <Tab value="overview" label="Overview" component={RouterLink} to={base} />
            <Tab value="departments" label="Departments" component={RouterLink} to={`${base}/departments`} />
            <Tab value="facilities" label="Facilities" component={RouterLink} to={`${base}/facilities`} />
          </Tabs>
          {section === 'overview' && <Overview hospitalId={h.id} items={[['Name', h.name], ['Code', h.code], ['Address', h.address], ['City', h.city], ['Phone', h.phone], ['E-mail', h.email]]} />}
          {section === 'departments' && <DepartmentsPanel hospitalId={h.id} canManage={canManage} />}
          {section === 'facilities' && <FacilitiesPanel hospitalId={h.id} />}
          <ConfirmDialog ref={confirm} />
        </>
      )}
    </QueryBoundary>
  );
}

function Overview({ hospitalId, items }: { hospitalId: number; items: Array<[string, React.ReactNode]> }) {
  const docs = useDoctorList({ hospitalId, size: 100 });
  const deps = useDepartments(hospitalId);
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 8 }}><Card variant="outlined"><CardContent><DetailsGrid items={items} /></CardContent></Card></Grid>
      <Grid size={{ xs: 12, md: 4 }}><Card variant="outlined"><CardContent><Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">At a glance</Typography>
        <Typography variant="h4" fontWeight={700}>{deps.data?.length ?? '…'}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: -0.5 }}>departments</Typography>
        <Typography variant="h4" fontWeight={700}>{docs.data?.totalElements ?? '…'}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: -0.5 }}>doctors</Typography>
      </Stack></CardContent></Card></Grid>
    </Grid>
  );
}

function DepartmentsPanel({ hospitalId, canManage }: { hospitalId: number; canManage: boolean }) {
  const query = useDepartments(hospitalId);
  const remove = useDeleteDepartment(hospitalId);
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const confirm = useRef<ConfirmDialogHandle>(null);
  return (
    <>
      {canManage && <Box sx={{ mb: 2 }}><Button startIcon={<AddCircleOutline />} variant="outlined" onClick={() => setEditing('new')}>Add department</Button></Box>}
      <QueryBoundary query={query} emptyTitle="No departments yet" emptyDescription="Create the first department for this hospital.">
        {(rows) => (
          <Card variant="outlined"><List disablePadding>{rows.map((d) => (
            <ListItem key={d.id} divider secondaryAction={canManage && <><IconButton aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)}><EditOutlined fontSize="small" /></IconButton><IconButton aria-label={`Remove ${d.name}`} onClick={() => confirm.current?.ask({ title: `Remove ${d.name}?`, message: 'Doctors assigned to this department keep their record.', destructive: true, confirmLabel: 'Remove', onConfirm: () => remove.mutateAsync(d.id).then(() => undefined) })}><DeleteOutline fontSize="small" /></IconButton></>}>
              <ListItemText primary={d.name} secondary={d.description ?? 'No description'} />
            </ListItem>
          ))}</List></Card>
        )}
      </QueryBoundary>
      {editing && <DepartmentDialog hospitalId={hospitalId} department={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog ref={confirm} />
    </>
  );
}

/** Dialog form with custom (hand-written) validation. */
function DepartmentDialog({ hospitalId, department, onClose }: { hospitalId: number; department?: Department; onClose: () => void }) {
  const save = useSaveDepartment(hospitalId, department?.id);
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const submit = async () => {
    const e = validateDepartment(name, description);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
      toast.success(department ? 'Department updated' : 'Department added');
      onClose();
    } catch (err) {
      setServerError(isApiError(err) && err.status === 409 ? `A department named "${name.trim()}" already exists in this hospital.` : errorMessage(err));
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="dept-title">
      <DialogTitle id="dept-title">{department ? 'Edit department' : 'New department'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <TextField autoFocus label="Name" value={name} onChange={(e) => setName(e.target.value)} error={!!errors.name} helperText={errors.name} required />
          <TextField label="Description" multiline minRows={2} value={description} onChange={(e) => setDescription(e.target.value)} error={!!errors.description} helperText={errors.description} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button></DialogActions>
    </Dialog>
  );
}

function FacilitiesPanel({ hospitalId }: { hospitalId: number }) {
  const query = useDepartments(hospitalId);
  return (
    <Stack spacing={2}>
      <Alert severity="info">The backend has no separate facility or branch resource. Facilities are shown here as the active departments of this hospital (clinical and support units); branches are represented by separate hospital records.</Alert>
      <QueryBoundary query={query} emptyTitle="No facilities recorded">
        {(rows) => (
          <Grid container spacing={2}>{rows.filter((d) => d.active).map((d) => <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}><Card variant="outlined"><CardContent><Typography fontWeight={700}>{d.name}</Typography><Typography variant="body2" color="text.secondary">{d.description ?? 'Operating unit'}</Typography></CardContent></Card></Grid>)}</Grid>
        )}
      </QueryBoundary>
    </Stack>
  );
}
