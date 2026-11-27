import { env, envInt } from '@hr/common';

export const authConfig = {
  port: envInt('AUTH_SERVICE_PORT', 31101),
  database: env('AUTH_DB', 'hr_auth_db'),
  maxFailedAttempts: envInt('LOGIN_MAX_FAILED_ATTEMPTS', 5),
  lockMinutes: envInt('LOGIN_LOCK_MINUTES', 15),
  resetTokenMinutes: 30,
};
