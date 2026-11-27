import { env, envInt } from '@hr/common';
export const leaveConfig = { port: envInt('LEAVE_SERVICE_PORT', 31104), database: env('LEAVE_DB', 'hr_leave_db'), balanceTtl: 300, backdateDays: envInt('LEAVE_BACKDATE_DAYS', 30) };
