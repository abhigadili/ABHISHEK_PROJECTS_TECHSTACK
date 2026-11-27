import { z } from 'zod';
import { CODE_RE, optionalText, requiredText } from './common';

export const departmentSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(20).regex(CODE_RE, 'Use A-Z, 0-9, _ or -'),
  name: requiredText('Name', 100),
  description: optionalText(500),
  headEmployeeId: z.string(),
});
export type DepartmentFormValues = z.infer<typeof departmentSchema>;

export const designationSchema = z.object({
  name: requiredText('Name', 100),
  description: optionalText(500),
  jobLevel: z
    .string()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 20, 'Level must be between 1 and 20'),
});
export type DesignationFormValues = z.infer<typeof designationSchema>;
