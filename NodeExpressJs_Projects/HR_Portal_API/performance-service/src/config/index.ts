import { env, envInt } from '@hr/common';
export const perfConfig = { port: envInt('PERFORMANCE_SERVICE_PORT', 31109), database: env('PERFORMANCE_DB', 'hr_performance_db'), managerWeight: Number(env('PERF_MANAGER_WEIGHT', '0.7')) };
