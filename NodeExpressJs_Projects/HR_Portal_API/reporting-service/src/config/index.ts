import { env, envInt } from '@hr/common';
export const reportingConfig = { port: envInt('REPORTING_SERVICE_PORT', 31115), database: env('REPORTING_DB', 'hr_reporting_db'), cacheTtl: 120 };
