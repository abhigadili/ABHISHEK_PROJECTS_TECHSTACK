import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import dayjs from 'dayjs';
import { Alert, Box, Button, Card, CardContent, Chip, Grid2 as Grid, IconButton, MenuItem, Stack, TextField, Typography, Paper, List, ListItem, ListItemText, ListItemSecondaryAction, Tooltip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import type { DoctorOutletContext } from './DoctorDetailsPage';
import { useDoctorSchedule, useDoctorSlots, useDoctorUnavailability, useSaveSchedule, useUnavailabilityMutations } from '../hooks/useDoctors';
import { useDepartmentDirectory } from '@/features/hospitals/hooks/useHospitals';
import { scheduleSchema, type ScheduleFormValues } from '@/schemas/doctor';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { DetailsGrid } from '../components/DetailsGrid';
import { MuiSimpleTable } from '@/features/patients/components/MuiSimpleTable';
import { AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { queryKeys } from '@/services/queryKeys';
import { groupSlots } from '@/utils/slots';
import { formatCurrency, formatDate, formatTimeRange, humanize, todayISO, toISODate, emptyToNull } from '@/utils/format';
import { DAYS_OF_WEEK, type DayOfWeek, type ScheduleDay } from '@/types';

const useDoc = () => useOutletContext<DoctorOutletContext>();

/* ------------------------------ Profile ------------------------------ */
export function DoctorProfileTab() {
  const { doctor: d } = useDoc();
  const { directory } = useDepartmentDirectory();
  const dept = d.departmentId ? directory.get(d.departmentId) : undefined;
  return (
    <Card variant="outlined"><CardContent>
      <DetailsGrid items={[
        ['Full name', d.fullName], ['Specialization', d.specialization], ['Qualification', d.qualification], ['Experience', d.experienceYears !== null ? `${d.experienceYears} years` : null],
        ['Consultation fee', formatCurrency(d.consultationFee)], ['Licence number', d.licenseNumber], ['E-mail', d.email], ['Phone', d.phone],
        ['Hospital', dept?.hospital.name ?? `#${d.hospitalId}`], ['Department', dept?.department.name ?? (d.departmentId ? `#${d.departmentId}` : null)], ['Status', d.active ? 'Active' : 'Inactive'],
      ]} />
    </CardContent></Card>
  );
}

/* ------------------------------ Weekly schedule ------------------------------ */
const toForm = (days: ScheduleDay[]): ScheduleFormValues => ({
  days: days.map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime.slice(0, 5), endTime: d.endTime.slice(0, 5), slotMinutes: d.slotMinutes, breakStart: d.breakStart?.slice(0, 5) ?? '', breakEnd: d.breakEnd?.slice(0, 5) ?? '' })),
});

export function DoctorScheduleTab() {
  const { doctor, canManageSchedule } = useDoc();
  const query = useDoctorSchedule(doctor.id);
  return (
    <QueryBoundary query={query} isEmpty={() => false}>
      {(days) => (canManageSchedule ? <ScheduleEditor doctorId={doctor.id} days={days} /> : <ScheduleReadOnly days={days} />)}
    </QueryBoundary>
  );
}

function ScheduleReadOnly({ days }: { days: ScheduleDay[] }) {
  if (days.length === 0) return <Alert severity="info">No weekly schedule has been configured for this doctor.</Alert>;
  const sorted = [...days].sort((a, b) => DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek));
  return (
    <MuiSimpleTable label="Weekly schedule" rows={sorted} rowKey={(d) => d.dayOfWeek}
      columns={[
        { key: 'day', header: 'Day', cell: (d) => humanize(d.dayOfWeek) }, { key: 'hours', header: 'Working hours', cell: (d) => formatTimeRange(d.startTime, d.endTime) },
        { key: 'slot', header: 'Slot length', cell: (d) => `${d.slotMinutes} min` }, { key: 'break', header: 'Break', cell: (d) => (d.breakStart && d.breakEnd ? formatTimeRange(d.breakStart, d.breakEnd) : '—') },
      ]} />
  );
}

/** React Hook Form + Zod + useFieldArray: one row per working weekday, cross-field and cross-row validation. */
function ScheduleEditor({ doctorId, days }: { doctorId: number; days: ScheduleDay[] }) {
  const save = useSaveSchedule(doctorId);
  const { control, register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ScheduleFormValues>({ resolver: zodResolver(scheduleSchema), values: toForm(days) });
  const { fields, append, remove } = useFieldArray({ control, name: 'days' });
  const used = fields.map((f) => f.dayOfWeek);
  const nextDay = DAYS_OF_WEEK.find((d) => !used.includes(d));
  const onSubmit = handleSubmit(async (v) => {
    const payload: ScheduleDay[] = v.days.map((d) => ({ dayOfWeek: d.dayOfWeek as DayOfWeek, startTime: d.startTime, endTime: d.endTime, slotMinutes: d.slotMinutes, breakStart: emptyToNull(d.breakStart), breakEnd: emptyToNull(d.breakEnd) }));
    await save.mutateAsync(payload);
    reset(v);
  });
  return (
    <Box component="form" onSubmit={onSubmit} noValidate aria-label="Weekly schedule editor">
      <Stack spacing={1.5}>
        {fields.length === 0 && <Alert severity="info">No working days yet - add one below. Saving an empty schedule removes all availability.</Alert>}
        {fields.map((f, i) => {
          const e = errors.days?.[i];
          return (
            <Paper key={f.id} variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={1.5} alignItems="flex-start">
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Controller control={control} name={`days.${i}.dayOfWeek`} render={({ field }) => (
                    <TextField select fullWidth size="small" label="Day" {...field} error={!!e?.dayOfWeek} helperText={e?.dayOfWeek?.message}>{DAYS_OF_WEEK.map((d) => <MenuItem key={d} value={d}>{humanize(d)}</MenuItem>)}</TextField>
                  )} />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}><TextField fullWidth size="small" label="Start" type="time" slotProps={{ inputLabel: { shrink: true } }} {...register(`days.${i}.startTime`)} error={!!e?.startTime} helperText={e?.startTime?.message} /></Grid>
                <Grid size={{ xs: 6, sm: 2 }}><TextField fullWidth size="small" label="End" type="time" slotProps={{ inputLabel: { shrink: true } }} {...register(`days.${i}.endTime`)} error={!!e?.endTime} helperText={e?.endTime?.message} /></Grid>
                <Grid size={{ xs: 6, sm: 1.5 }}><TextField fullWidth size="small" label="Slot (min)" type="number" {...register(`days.${i}.slotMinutes`)} error={!!e?.slotMinutes} helperText={e?.slotMinutes?.message} /></Grid>
                <Grid size={{ xs: 6, sm: 1.75 }}><TextField fullWidth size="small" label="Break from" type="time" slotProps={{ inputLabel: { shrink: true } }} {...register(`days.${i}.breakStart`)} error={!!e?.breakStart} helperText={e?.breakStart?.message} /></Grid>
                <Grid size={{ xs: 6, sm: 1.75 }}><TextField fullWidth size="small" label="Break to" type="time" slotProps={{ inputLabel: { shrink: true } }} {...register(`days.${i}.breakEnd`)} error={!!e?.breakEnd} helperText={e?.breakEnd?.message} /></Grid>
                <Grid size={{ xs: 12, sm: 'auto' }}><Tooltip title="Remove day"><IconButton aria-label={`Remove row ${i + 1}`} onClick={() => remove(i)}><DeleteOutline /></IconButton></Tooltip></Grid>
              </Grid>
            </Paper>
          );
        })}
        <Stack direction="row" spacing={1}>
          <Button startIcon={<AddCircleOutline />} disabled={!nextDay} onClick={() => nextDay && append({ dayOfWeek: nextDay, startTime: '09:00', endTime: '13:00', slotMinutes: 30, breakStart: '', breakEnd: '' })}>Add working day</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => reset()} disabled={!isDirty || save.isPending}>Discard</Button>
          <Button type="submit" variant="contained" disabled={!isDirty || save.isPending}>{save.isPending ? 'Saving…' : 'Save schedule'}</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

/* ------------------------------ Availability (slots + days off) ------------------------------ */
export function DoctorAvailabilityTab() {
  const { doctor, canManageSchedule } = useDoc();
  const [date, setDate] = useState(todayISO());
  const slots = useDoctorSlots(doctor.id, date);
  const booked = useQuery({ queryKey: queryKeys.appointments.availability(doctor.id, date), queryFn: ({ signal }) => appointmentApi.availability(doctor.id, date, signal), enabled: !!date });
  const off = useDoctorUnavailability(doctor.id);
  const { add, remove } = useUnavailabilityMutations(doctor.id);
  const [reason, setReason] = useState('');
  const navigate = useNavigate();

  // slot grid (schedule only) merged with the booking view (appointment-service availability): available vs occupied
  const merged = useMemo(() => {
    const occupied = new Set((booked.data ?? []).filter((s) => !s.available).map((s) => s.startTime));
    return (slots.data ?? []).map((s) => ({ ...s, available: s.available && !occupied.has(s.startTime) }));
  }, [slots.data, booked.data]);
  const groups = useMemo(() => groupSlots(merged), [merged]);
  const isOff = (off.data ?? []).some((o) => o.date === date);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card variant="outlined"><CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
            <DatePicker label="Date" value={dayjs(date)} onChange={(d) => d && d.isValid() && setDate(toISODate(d))} slotProps={{ textField: { size: 'small' } }} />
            <Stack direction="row" spacing={1}><Chip size="small" color="success" label={`${merged.filter((s) => s.available).length} free`} /><Chip size="small" color="default" label={`${merged.filter((s) => !s.available).length} occupied`} /></Stack>
          </Stack>
          <QueryBoundary query={slots} isEmpty={() => false}>
            {() => groups.length === 0 ? <Alert severity="info">{isOff ? 'The doctor is on leave on this date.' : 'No working hours on this day.'}</Alert> : (
              <Stack spacing={2}>
                {groups.map((g) => (
                  <Box key={g.period}>
                    <Typography variant="overline" color="text.secondary">{g.period}</Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {g.slots.map((s) => (
                        <Chip key={s.startTime} label={s.startTime} color={s.available ? 'success' : 'default'} variant={s.available ? 'outlined' : 'filled'} disabled={!s.available}
                          onClick={s.available && (doctor.active) ? () => navigate(`/appointments/book?doctorId=${doctor.id}&date=${date}&time=${s.startTime}`) : undefined} aria-label={`${s.startTime} ${s.available ? 'available' : 'occupied'}`} />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </QueryBoundary>
        </CardContent></Card>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card variant="outlined"><CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Days off</Typography>
          <QueryBoundary query={off} emptyTitle="No days off" emptyDescription="Planned leave will show here.">
            {(rows) => <List dense disablePadding>{rows.map((o) => (
              <ListItem key={o.id} divider disableGutters>
                <ListItemText primary={formatDate(o.date)} secondary={o.reason ?? undefined} />
                {canManageSchedule && <ListItemSecondaryAction><IconButton edge="end" aria-label={`Remove ${o.date}`} disabled={remove.isPending} onClick={() => remove.mutate(o.id)}><DeleteOutline fontSize="small" /></IconButton></ListItemSecondaryAction>}
              </ListItem>
            ))}</List>}
          </QueryBoundary>
          {canManageSchedule && (
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <TextField size="small" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="outlined" disabled={add.isPending} onClick={() => add.mutate({ date, reason: reason.trim() || null }, { onSuccess: () => setReason('') })}>Mark {formatDate(date)} as day off</Button>
            </Stack>
          )}
        </CardContent></Card>
      </Grid>
    </Grid>
  );
}

/* ------------------------------ Appointments of this doctor ------------------------------ */
export function DoctorAppointmentsTab() {
  const { doctor } = useDoc();
  const navigate = useNavigate();
  const [date, setDate] = useState<string>('');
  const query = useQuery({ queryKey: queryKeys.appointments.forDoctor(doctor.id, date || undefined), queryFn: ({ signal }) => appointmentApi.forDoctor(doctor.id, date || undefined, signal) });
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <DatePicker label="Filter by date" value={date ? dayjs(date) : null} onChange={(d) => setDate(d && d.isValid() ? toISODate(d) : '')} slotProps={{ textField: { size: 'small' }, field: { clearable: true } }} />
        {date && <Button onClick={() => setDate('')}>Show all</Button>}
      </Stack>
      <QueryBoundary query={query} emptyTitle="No appointments" emptyDescription="Nothing is booked for this selection.">
        {(rows) => (
          <MuiSimpleTable label="Doctor appointments" rows={[...rows].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))} rowKey={(a) => a.id} onRowClick={(a) => navigate(`/appointments/${a.id}`)}
            columns={[
              { key: 'd', header: 'Date', cell: (a) => formatDate(a.date) }, { key: 't', header: 'Time', cell: (a) => formatTimeRange(a.startTime, a.endTime) },
              { key: 'p', header: 'Patient', cell: (a) => a.patientName }, { key: 'r', header: 'Reason', cell: (a) => a.reason ?? '—' }, { key: 's', header: 'Status', cell: (a) => <AppointmentStatusBadge status={a.status} /> },
            ]} />
        )}
      </QueryBoundary>
    </Stack>
  );
}
