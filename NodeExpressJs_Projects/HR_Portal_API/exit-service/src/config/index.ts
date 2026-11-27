import { env, envInt } from '@hr/common';
export const exitConfig = { port: envInt('EXIT_SERVICE_PORT', 31112), database: env('EXIT_DB', 'hr_exit_db') };
