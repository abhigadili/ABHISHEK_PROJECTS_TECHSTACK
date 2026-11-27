import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { MonthNav } from '@/components/common/MonthNav';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { FilterSelect } from '@/components/tables/FilterSelect';
import { useLeaveCalendarQuery } from '@/store/api/emsApi';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { shiftCalendarMonth } from '@/store/slices/leaveSlice';
import { useDepartmentFilter, useDepartments } from '@/hooks/useDepartments';
import { usePermissions } from '@/hooks/usePermissions';
import { classNames, endOfMonth, parseDate, startOfMonth, toIsoDate, today } from '@/utils/format';
import { errorMessage } from '@/api/errors';
import type { LeaveRequest } from '@/types/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Team leave calendar: approved/pending leave + holidays + weekly offs for a month, from `/calendar/leave`. */
export default function LeaveCalendarPage() {
  const dispatch = useAppDispatch();
  const { year, month } = useAppSelector((s) => s.leave.calendar);
  const { isManagerUp } = usePermissions();
  const [deptFilter, setDeptFilter] = useDepartmentFilter();
  const { options } = useDepartments({ skip: !isManagerUp });
  const { data, isLoading, isFetching, isError, error, refetch } = useLeaveCalendarQuery({
    year,
    month,
    departmentId: isManagerUp ? (deptFilter ?? undefined) : undefined,
  });
  const todayIso = today();

  const days = useMemo(() => {
    const first = startOfMonth(year, month);
    const last = endOfMonth(year, month);
    const out: string[] = [];
    for (let d = parseDate(first); toIsoDate(d) <= last; d.setDate(d.getDate() + 1)) out.push(toIsoDate(d));
    return out;
  }, [year, month]);
  const byDay = useMemo(() => {
    const m = new Map<string, LeaveRequest[]>();
    (data?.leaves ?? [])
      .filter((l) => l.status !== 'REJECTED' && l.status !== 'CANCELLED')
      .forEach((l) =>
        days.forEach((d) => {
          if (d >= l.startDate && d <= l.endDate) m.set(d, [...(m.get(d) ?? []), l]);
        }),
      );
    return m;
  }, [data, days]);
  const holidays = useMemo(
    () => new Map((data?.holidays ?? []).map((h) => [h.holidayDate.slice(0, 10), h.name])),
    [data],
  );
  const lead = parseDate(days[0]).getDay();

  return (
    <>
      <PageHeader
        title="Leave calendar"
        actions={<MonthNav year={year} month={month} onShift={(d) => dispatch(shiftCalendarMonth(d))} />}
      />
      {isManagerUp && (
        <Box sx={{ mb: 2 }}>
          <FilterSelect
            label="Department"
            value={deptFilter ? String(deptFilter) : ''}
            options={options}
            onChange={(v) => setDeptFilter(v ? Number(v) : null)}
          />
        </Box>
      )}
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <ErrorMessage message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <Card sx={{ opacity: isFetching ? 0.6 : 1 }}>
          <CardContent>
            <Box className="cal-grid" sx={{ mb: 0.5 }}>
              {WEEKDAYS.map((d) => (
                <Typography key={d} variant="caption" align="center" color="text.secondary">
                  {d}
                </Typography>
              ))}
            </Box>
            <Box className="cal-grid" role="grid" aria-label="Leave calendar">
              {Array.from({ length: lead }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {days.map((d) => {
                const leaves = byDay.get(d) ?? [];
                const off = data.weeklyOffDays.includes(parseDate(d).getDay());
                return (
                  <Box
                    key={d}
                    role="gridcell"
                    className={classNames(
                      'cal-cell',
                      off && 'off',
                      holidays.has(d) && 'holiday',
                      d === todayIso && 'today',
                    )}
                  >
                    <Typography variant="caption" fontWeight={700}>
                      {Number(d.slice(8))}
                    </Typography>
                    {holidays.has(d) && (
                      <Typography variant="caption" display="block" noWrap>
                        {holidays.get(d)}
                      </Typography>
                    )}
                    {leaves.slice(0, 2).map((l) => (
                      <Chip
                        key={l.id}
                        size="small"
                        label={l.employeeName.split(' ')[0]}
                        color={l.status === 'APPROVED' ? 'success' : 'warning'}
                        sx={{ height: 18, fontSize: '.65rem', display: 'flex', mb: 0.25 }}
                        title={`${l.employeeName} · ${l.leaveType.name} · ${l.status}`}
                      />
                    ))}
                    {leaves.length > 2 && (
                      <Typography variant="caption">+{leaves.length - 2} more</Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Green = approved, amber = pending. Grey = weekly off, purple = holiday.
            </Typography>
          </CardContent>
        </Card>
      )}
    </>
  );
}
