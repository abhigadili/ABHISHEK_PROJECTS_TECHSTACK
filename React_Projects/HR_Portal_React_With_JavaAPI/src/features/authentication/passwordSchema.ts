import { z } from 'zod';
import type { TFunction } from 'i18next';
/** Mirrors the backend @StrongPassword rule: 10-72 chars, upper + lower + digit + symbol, no whitespace. */
export const strongPassword = (t: TFunction) => z.string().min(10, t('auth.passwordRules')).max(72, t('auth.passwordRules'))
  .regex(/[a-z]/, t('auth.passwordRules')).regex(/[A-Z]/, t('auth.passwordRules')).regex(/\d/, t('auth.passwordRules')).regex(/[^A-Za-z0-9\s]/, t('auth.passwordRules')).regex(/^\S+$/, t('auth.passwordRules'));
