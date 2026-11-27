import { env, envInt } from '@hr/common';
export const documentConfig = { port: envInt('DOCUMENT_SERVICE_PORT', 31113), database: env('DOCUMENT_DB', 'hr_document_db'), expiryWarningDays: envInt('DOCUMENT_EXPIRY_WARNING_DAYS', 30) };
