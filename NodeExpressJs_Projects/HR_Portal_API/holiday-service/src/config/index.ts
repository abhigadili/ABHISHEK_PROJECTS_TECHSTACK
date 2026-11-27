import { env, envInt } from '@hr/common';
export const holidayConfig = { port: envInt('HOLIDAY_SERVICE_PORT', 31106), database: env('HOLIDAY_DB', 'hr_holiday_db'), calendarTtl: 600 };
