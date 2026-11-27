import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { MonthNav } from '@/components/common/MonthNav';
import { ErrorMessage, Loading } from '@/components/common/Feedback';
import { useAttendanceCalendarQuery } from '@/store/api/emsApi';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { shiftCalendarMonth } from '@/store/slices/leaveSlice';
import { classNames, humanize, parseDate, today } from '@/utils/format';
import { errorMessage } from '@/api/errors';
import type { AttendanceStatus } from '@/types/api';

const COLOR: Record<AttendanceStatus, 'success' | 'error' | 'warning' | 'info' | 'secondary' | 'default'> = {
  PRESENT: 'success',
  ABSENT: 'error',
  HALF_DAY: 'warning',
  ON_LEAVE: 'info',
  HOLIDAY: 'secondary',
  WEEKLY_OFF: 'default',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Monthly attendance calendar for the signed-in user; the working/holiday/weekly-off classification comes from the backend. */
export default function AttendanceCalendarPage() {
  const dispatch = useAppDispatch();
  const { year, month } = useAppSelector((s) => s.leave.calendar);
  const { data, isLoading, isFetching, isError, error, refetch } = useAttendanceCalendarQuery({
    year,
    month,
  });
  const todayIso = today();

  const cells = useMemo(() => {
    if (!data) return [];
    const lead = parseDate(data.days[0].date).getDay();
    return [...Array.from({ length: lead }, () => null), ...data.days];
  }, [data]);

  return (
    <>
      <PageHeader
        title="Attendance calendar"
        actions={<MonthNav year={year} month={month} onShift={(d) => dispatch(shiftCalendarMonth(d))} />}
      />
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
            <Box className="cal-grid" role="grid" aria-label="Attendance calendar">
              {cells.map((c, i) =>
                c === null ? (
                  <div key={`b${i}`} />
                ) : (
                  <Box
                    key={c.date}
                    role="gridcell"
                    className={classNames(
                      'cal-cell',
                      c.calendarDayType === 'WEEKLY_OFF' && 'off',
                      c.calendarDayType === 'HOLIDAY' && 'holiday',
                      c.date === todayIso && 'today',
                    )}
                  >
                    <Typography variant="caption" fontWeight={700}>
                      {Number(c.date.slice(8))}
                    </Typography>
                    {c.holidayName && (
                      <Typography variant="caption" display="block" noWrap>
                        {c.holidayName}
                      </Typography>
                    )}
                    {c.recorded && (
                      <Chip
                        size="small"
                        label={humanize((c.recorded as { status: AttendanceStatus }).status)}
                        color={COLOR[(c.recorded as { status: AttendanceStatus }).status]}
                        sx={{ height: 18, fontSize: '.65rem', maxWidth: '100%' }}
                      />
                    )}
                  </Box>
                ),
              )}
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              {(Object.keys(COLOR) as AttendanceStatus[]).map((s) => (
                <Chip key={s} size="small" label={humanize(s)} color={COLOR[s]} variant="outlined" />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  );
}
