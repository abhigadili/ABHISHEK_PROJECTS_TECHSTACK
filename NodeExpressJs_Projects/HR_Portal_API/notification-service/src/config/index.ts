import { env, envInt } from '@hr/common';
export const notificationConfig = { port: envInt('NOTIFICATION_SERVICE_PORT', 31114), database: env('NOTIFICATION_DB', 'hr_notification_db'), dedupeSeconds: envInt('NOTIFICATION_DEDUPE_SECONDS', 3600) };
