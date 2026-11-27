import { z, zDate, zId, zMonth } from '@hr/common';
import { fyShape } from './shared';

export const periodQuery = z.object({ from: zDate.optional(), to: zDate.optional(), departmentId: zId.optional() }).refine((q) => !q.from || !q.to || q.to >= q.from, 'to must not precede from');
export const monthQuery = z.object({ month: zMonth.optional(), departmentId: zId.optional() });
export const fyQuery = z.object({ financialYear: fyShape.optional() });
export const cycleQuery = z.object({ cycleId: zId });
export const projectQuery = z.object({ status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional() });
export const exportParam = z.object({ report: z.enum(['employees', 'leave', 'exits']) });
