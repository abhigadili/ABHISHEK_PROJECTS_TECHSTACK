import { env, envInt } from '@hr/common';
export const taxConfig = { port: envInt('TAX_SERVICE_PORT', 31108), database: env('TAX_DB', 'hr_tax_db'), maxProofAttempts: 3, rulesTtl: 600 };
