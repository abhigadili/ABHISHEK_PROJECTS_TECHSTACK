import { env, envInt } from '@hr/common';
export const orgConfig = { port: envInt('ORGANIZATION_SERVICE_PORT', 31103), database: env('ORGANIZATION_DB', 'hr_organization_db'), chartTtl: 300 };
