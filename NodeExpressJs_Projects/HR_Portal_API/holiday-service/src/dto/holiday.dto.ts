import { z, zDate, zId } from '@hr/common';

export const holidayDto = z.object({
  name: z.string().min(1).max(150), date: zDate, type: z.enum(['MANDATORY', 'OPTIONAL', 'RESTRICTED']).default('MANDATORY'), description: z.string().max(255).optional(),
  locationIds: z.array(zId).default([]), departmentIds: z.array(zId).default([]),
});
export const holidayUpdateDto = holidayDto.partial();
export const holidayQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(), from: zDate.optional(), to: zDate.optional(), locationId: zId.optional(), departmentId: zId.optional(),
  type: z.enum(['MANDATORY', 'OPTIONAL', 'RESTRICTED']).optional(),
}).refine((q) => !q.from || !q.to || q.to >= q.from, 'to must not precede from');
export const upcomingQuery = z.object({ locationId: zId.optional(), departmentId: zId.optional(), limit: z.coerce.number().int().min(1).max(50).default(10) });
export const holidayYearDto = z.object({ yearNumber: z.number().int().min(2000).max(2100), startDate: zDate, endDate: zDate, description: z.string().max(255).optional(), active: z.boolean().default(true) })
  .refine((d) => d.endDate >= d.startDate, 'endDate must not precede startDate');
export const countQuery = z.object({ from: zDate, to: zDate, locationId: zId.optional(), departmentId: zId.optional() });
