import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Modal } from '@/components/dialogs/Modal';
import { FormCheckbox, FormTextField } from '@/components/forms/fields';
import { Can } from '@/components/common/Can';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import { MonthNav } from '@/components/common/MonthNav';
import {
  useCreateHolidayMutation,
  useDeleteHolidayMutation,
  useListHolidaysQuery,
  useListWeeklyOffsQuery,
  useSetWeeklyOffsMutation,
  useUpdateHolidayMutation,
} from '@/store/api/emsApi';
import { useModal } from '@/hooks/useModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotify } from '@/contexts/NotificationContext';
import { holidaySchema, type HolidayValues } from '@/schemas/leaveAttendance';
import { errorMessage } from '@/api/errors';
import { classNames, formatDate, parseDate, toIsoDate, today } from '@/utils/format';
import type { Holiday } from '@/types/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HolidaysPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const { isAdmin } = usePermissions();
  const notify = useNotify();
  const confirm = useConfirm();
  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useListHolidaysQuery({ from: `${year}-01-01`, to: `${year}-12-31` });
  const [remove] = useDeleteHolidayMutation();
  const modal = useModal<Holiday | null>();

  const del = async (h: Holiday) => {
    if (
      !(await confirm({
        title: 'Delete holiday?',
        message: `${h.name} · ${formatDate(h.holidayDate)}`,
        confirmLabel: 'Delete',
        destructive: true,
      }))
    )
      return;
    try {
      await remove(h.id).unwrap();
      notify.success('Holiday deleted');
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };

  const columns: Column<Holiday>[] = [
    { key: 'holidayDate', header: 'Date', render: (h) => formatDate(h.holidayDate) },
    { key: 'day', header: 'Day', hideBelow: 'sm', render: (h) => DAYS[parseDate(h.holidayDate).getDay()] },
    { key: 'name', header: 'Holiday' },
    { key: 'isOptional', header: 'Type', render: (h) => (h.isOptional ? 'Optional' : 'Public') },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: '',
            render: (h: Holiday) => (
              <Stack direction="row">
                <Button size="small" onClick={() => modal.open(h)}>
                  Edit
                </Button>
                <Button size="small" color="error" onClick={() => del(h)}>
                  Delete
                </Button>
              </Stack>
            ),
          },
        ]
      : []),
  ];

  const byDate = useMemo(() => new Map(data.map((h) => [h.holidayDate.slice(0, 10), h])), [data]);
  const monthDays = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(year, month - 1, 1); d.getMonth() === month - 1; d.setDate(d.getDate() + 1))
      out.push(toIsoDate(d));
    return out;
  }, [year, month]);
  const todayIso = today();

  return (
    <>
      <PageHeader
        title="Holidays"
        subtitle={`Company holidays for ${year}`}
        actions={
          <Can permission="holiday:manage">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => modal.open(null)}>
              Add holiday
            </Button>
          </Can>
        }
      />
      <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ mb: 2 }}>
        <Tab value="list" label="List" />
        <Tab value="calendar" label="Calendar" />
      </Tabs>
      {view === 'list' ? (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button onClick={() => setYear((y) => y - 1)}>◀ {year - 1}</Button>
            <Typography fontWeight={700}>{year}</Typography>
            <Button onClick={() => setYear((y) => y + 1)}>{year + 1} ▶</Button>
          </Stack>
          <DataTable<Holiday>
            caption="Holidays"
            columns={columns}
            rows={data}
            getRowId={(h) => h.id}
            loading={isLoading}
            error={isError ? errorMessage(error) : null}
            onRetry={refetch}
            emptyTitle="No holidays recorded for this year"
          />
          <WeeklyOffs />
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <MonthNav
                year={year}
                month={month}
                onShift={(d) => {
                  const x = new Date(year, month - 1 + d, 1);
                  setYear(x.getFullYear());
                  setMonth(x.getMonth() + 1);
                }}
              />
            </Box>
            <Box className="cal-grid" role="grid" aria-label="Holiday calendar">
              {Array.from({ length: parseDate(monthDays[0]).getDay() }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {monthDays.map((d) => {
                const h = byDate.get(d);
                return (
                  <Box
                    key={d}
                    role="gridcell"
                    className={classNames('cal-cell', h && 'holiday', d === todayIso && 'today')}
                  >
                    <Typography variant="caption" fontWeight={700}>
                      {Number(d.slice(8))}
                    </Typography>
                    {h && (
                      <Typography variant="caption" display="block">
                        {h.name}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}
      <HolidayDialog open={modal.isOpen} holiday={modal.data ?? null} onClose={modal.close} />
    </>
  );
}

function WeeklyOffs() {
  const { data = [] } = useListWeeklyOffsQuery();
  const [save, { isLoading }] = useSetWeeklyOffsMutation();
  const { isAdmin } = usePermissions();
  const notify = useNotify();
  const initial = useMemo(() => data.filter((w) => w.location === 'ALL').map((w) => w.dayOfWeek), [data]);
  const [days, setDays] = useState<number[]>(initial);
  useEffect(() => setDays(initial), [initial]);
  const toggle = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  const onSave = async () => {
    try {
      await save(days).unwrap();
      notify.success('Weekly offs saved');
    } catch (e) {
      notify.error(errorMessage(e));
    }
  };
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Weekly offs
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap>
          {DAYS.map((d, i) => (
            <FormControlLabel
              key={d}
              label={d}
              control={<Checkbox checked={days.includes(i)} disabled={!isAdmin} onChange={() => toggle(i)} />}
            />
          ))}
        </Stack>
        {isAdmin && (
          <Button
            variant="outlined"
            onClick={onSave}
            disabled={isLoading || days.join() === initial.join()}
            sx={{ mt: 1 }}
          >
            Save weekly offs
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function HolidayDialog({
  open,
  holiday,
  onClose,
}: {
  open: boolean;
  holiday: Holiday | null;
  onClose: () => void;
}) {
  const [create] = useCreateHolidayMutation();
  const [update] = useUpdateHolidayMutation();
  const notify = useNotify();
  const methods = useForm<HolidayValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { holidayDate: '', name: '', isOptional: false },
  });
  const { reset } = methods;
  useEffect(() => {
    if (open)
      reset(
        holiday
          ? {
              holidayDate: holiday.holidayDate.slice(0, 10),
              name: holiday.name,
              isOptional: holiday.isOptional,
            }
          : { holidayDate: '', name: '', isOptional: false },
      );
  }, [open, holiday, reset]);
  const submit = methods.handleSubmit(async (v) => {
    try {
      if (holiday) await update({ id: holiday.id, body: v }).unwrap();
      else await create(v).unwrap();
      notify.success(holiday ? 'Holiday updated' : 'Holiday added');
      onClose();
    } catch (e) {
      notify.error(errorMessage(e));
    }
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={holiday ? 'Edit holiday' : 'Add holiday'}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <FormProvider {...methods}>
        <Stack spacing={2} component="form" onSubmit={submit} noValidate>
          <FormTextField<HolidayValues> name="holidayDate" label="Date" type="date" />
          <FormTextField<HolidayValues> name="name" label="Name" />
          <FormCheckbox<HolidayValues> name="isOptional" label="Optional holiday" />
        </Stack>
      </FormProvider>
    </Modal>
  );
}
