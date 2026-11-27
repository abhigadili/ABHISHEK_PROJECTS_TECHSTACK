import { z } from 'zod';
import { ISO_DATE_RE, optionalText, passwordSchema, PHONE_RE, requiredText } from './common';

/** The backend accepts the registered username OR the e-mail address, so the form has one "identifier" field. */
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required').max(190),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});

/** Confirm-password + cross-field validation with superRefine. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, 'Paste the full reset token'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current one',
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const userCreateSchema = z
  .object({
    role: z.enum(['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type UserCreateValues = z.infer<typeof userCreateSchema>;

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/i;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

const registerShape = {
  firstName: requiredText('First name', 60).regex(NAME_RE, 'Use letters only'),
  lastName: requiredText('Last name', 60).regex(NAME_RE, 'Use letters only'),
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .min(3, 'At least 3 characters')
    .max(30, 'At most 30 characters')
    .regex(USERNAME_RE, 'Letters, digits, dot, underscore or hyphen; start with a letter or digit'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(190, 'At most 190 characters'),
  mobile: z
    .string()
    .trim()
    .min(1, 'Mobile number is required')
    .regex(PHONE_RE, 'Enter a valid mobile number, e.g. +1 555 0100'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm your password'),
  dateOfBirth: z.string().min(1, 'Date of birth is required').regex(ISO_DATE_RE, 'Use a valid date'),
  // '' = nothing chosen yet (the refine callback returns an explicit `boolean`: TS 5.5 would otherwise infer a type predicate and narrow '' out of the type). A plain enum would ABORT parsing when unset and silently skip the cross-field rules (e.g. confirm password).
  gender: z
    .enum(['', 'MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
    .refine((g): boolean => g !== '', 'Select a gender'),
  address: optionalText(255),
  departmentId: z.string(),
  designationId: z.string(),
};

const registerRules = (
  v: { password: string; confirmPassword: string; dateOfBirth: string },
  ctx: z.RefinementCtx,
) => {
  if (v.confirmPassword && v.password !== v.confirmPassword)
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  if (
    v.dateOfBirth &&
    (v.dateOfBirth >= new Date().toISOString().slice(0, 10) || v.dateOfBirth < '1900-01-01')
  ) {
    ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Enter a past date of birth' });
  }
};

/**
 * Factory: the registration form adds a backend-dependent async rule (username uniqueness) while tests/other callers can use the plain
 * synchronous schema. The backend still enforces uniqueness (409 DUPLICATE_USERNAME / DUPLICATE_EMAIL) — a race can't slip through.
 */
export function createRegisterSchema(
  opts: { isUsernameTaken?: (username: string) => Promise<boolean> } = {},
) {
  const shape = opts.isUsernameTaken
    ? {
        ...registerShape,
        username: registerShape.username.refine(
          async (u) => !(await opts.isUsernameTaken!(u)),
          'This username is already taken',
        ),
      }
    : registerShape;
  return z.object(shape).superRefine(registerRules);
}
export const registerSchema = createRegisterSchema();
export type RegisterValues = z.infer<typeof registerSchema>;
