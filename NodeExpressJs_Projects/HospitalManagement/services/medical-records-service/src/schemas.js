import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const patientParams = z.object({ patientId: z.coerce.number().int().positive() });
export const ENTRY_TYPES = ['DIAGNOSIS', 'VISIT', 'LAB_REPORT', 'PRESCRIPTION', 'ALLERGY', 'NOTE'];
export const entryBody = z.object({ patientId: z.number().int().positive(), entryType: z.enum(ENTRY_TYPES), title: z.string().trim().min(1).max(200), details: z.string().max(4000).optional().nullable(), doctorId: z.number().int().positive().optional().nullable() });
export const entryUpdateBody = z.object({ title: z.string().trim().min(1).max(200), details: z.string().max(4000).optional().nullable() });
export const conditionsBody = z.object({ chronicConditions: z.string().max(500).optional().nullable() });
export const timelineQuery = z.object({ type: z.enum(ENTRY_TYPES).optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });
