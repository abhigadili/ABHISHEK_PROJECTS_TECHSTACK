import { env, envInt } from '@hr/common';
export const payrollConfig = { port: envInt('PAYROLL_SERVICE_PORT', 31107), database: env('PAYROLL_DB', 'hr_payroll_db'), configTtl: 300, batchSize: 8 };
