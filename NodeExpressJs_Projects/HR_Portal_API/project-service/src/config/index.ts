import { env, envInt } from '@hr/common';
export const projectConfig = { port: envInt('PROJECT_SERVICE_PORT', 31110), database: env('PROJECT_DB', 'hr_project_db') };
