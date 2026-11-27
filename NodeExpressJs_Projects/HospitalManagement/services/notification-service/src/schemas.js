import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const searchQuery = z.object({ eventType: z.string().optional(), email: z.string().optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });
export const pageQuery = z.object({ page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });
export const sendBody = z.object({ recipientEmail: z.email(), recipientPhone: z.string().max(20).optional().nullable(), subject: z.string().min(1).max(200), message: z.string().min(1).max(2000) });
