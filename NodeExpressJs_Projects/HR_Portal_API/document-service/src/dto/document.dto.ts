import { z, zDate, zId, pageQuery } from '@hr/common';

export const uploadFields = z.object({
  categoryId: zId, title: z.string().min(1).max(190), ownerEmployeeId: zId.optional(), expiryDate: zDate.optional(), source: z.enum(['MANUAL', 'LEAVE', 'TAX']).default('MANUAL'),
});
export const categoryDto = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/), name: z.string().min(1).max(120), description: z.string().max(255).optional(), readRoles: z.array(z.string()).min(1),
  requiresVerification: z.boolean().default(true), selfUploadAllowed: z.boolean().default(true), isSensitive: z.boolean().default(false), defaultExpiryMonths: z.number().int().min(1).max(600).nullable().optional(), active: z.boolean().default(true),
});
export const rejectDto = z.object({ reason: z.string().min(3).max(500) });
export const decisionDto = z.object({ comment: z.string().max(255).optional() });
export const grantDto = z.object({ granteeType: z.enum(['EMPLOYEE', 'ROLE']), granteeId: z.string().min(1).max(64), accessLevel: z.enum(['VIEW', 'DOWNLOAD']).default('VIEW'), expiresAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date-time').optional() });
export const listQuery = pageQuery.extend({ ownerEmployeeId: zId.optional(), categoryId: zId.optional(), status: z.enum(['UPLOADED', 'VERIFIED', 'APPROVED', 'REJECTED']).optional(), source: z.enum(['MANUAL', 'LEAVE', 'TAX', 'PAYSLIP', 'EXIT']).optional() });
export const expiringQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export const DOC_FIELDS = ['id', 'title', 'ownerEmployeeId', 'categoryId', 'fileName', 'contentType', 'sizeBytes', 'sha256', 'status', 'source', 'expiryDate', 'versionNumber', 'currentVersion', 'previousVersionId', 'rejectionReason', 'decidedAt', 'decidedBy', 'uploadedBy', 'createdAt', 'updatedAt'];
