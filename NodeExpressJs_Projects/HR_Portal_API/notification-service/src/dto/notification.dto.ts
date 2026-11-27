import { z, zEmail, zId, pageQuery } from '@hr/common';

export const listQuery = pageQuery.extend({ unread: z.enum(['true', 'false']).optional(), channel: z.enum(['IN_APP', 'EMAIL']).optional(), type: z.string().max(60).optional() });
export const historyQuery = pageQuery.extend({ topic: z.string().max(100).optional(), employeeId: zId.optional(), eventType: z.string().max(100).optional() });
export const templateDto = z.object({ code: z.string().min(2).max(60).regex(/^[A-Z0-9_]+$/), subjectTemplate: z.string().min(1).max(255), bodyTemplate: z.string().min(1).max(2000), description: z.string().max(255).optional(), active: z.boolean().default(true) });
export const previewDto = z.object({ variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}) });
export const emailSettingsDto = z.object({ enabled: z.boolean(), mode: z.enum(['LOG', 'SMTP']), fromAddress: zEmail, host: z.string().max(190).optional(), port: z.number().int().min(1).max(65535).optional(), username: z.string().max(190).optional(), startTls: z.boolean().default(true) })
  .refine((s) => s.mode === 'LOG' || (!!s.host && !!s.port), 'host and port are required for SMTP mode');
export const manualDto = z.object({ employeeIds: z.array(zId).min(1).max(1000), subject: z.string().min(1).max(190), message: z.string().min(1).max(2000) });
export const NOTIFICATION_FIELDS = ['id', 'type', 'channel', 'subject', 'body', 'status', 'readAt', 'sentAt', 'referenceType', 'referenceId', 'createdAt'];
