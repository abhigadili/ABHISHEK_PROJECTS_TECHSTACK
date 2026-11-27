import { env, envInt } from '@hr/common';
export const timesheetConfig = { port: envInt('TIMESHEET_SERVICE_PORT', 31111), database: env('TIMESHEET_DB', 'hr_timesheet_db'), maxHoursPerDay: envInt('TIMESHEET_MAX_HOURS_PER_DAY', 16), maxHoursPerWeek: envInt('TIMESHEET_MAX_HOURS_PER_WEEK', 84) };
