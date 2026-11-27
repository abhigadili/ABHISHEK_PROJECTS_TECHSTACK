import { env, envInt } from '@hr/common';
export const employeeConfig = { port: envInt('EMPLOYEE_SERVICE_PORT', 31102), database: env('EMPLOYEE_DB', 'hr_employee_db'), directoryTtl: 120, profileTtl: 300 };
