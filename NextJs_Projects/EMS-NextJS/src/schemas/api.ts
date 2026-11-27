import { z } from 'zod';
import { ROLES } from '@/constants/roles';

/** Runtime schemas for what the Express API returns. Server-side data access validates every response against them. */
export const roleSchema = z.enum(ROLES);
export const idName = z.object({ id: z.number(), name: z.string() });

export const pageMetaSchema = z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() });
export type PageMeta = z.infer<typeof pageMetaSchema>;
export interface Paged<T> { items: T[]; meta: PageMeta }

export const tokenPairSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), tokenType: z.string(), expiresIn: z.string() });
export const loginResponseSchema = tokenPairSchema.extend({
  user: z.object({ id: z.number(), username: z.string().nullish(), email: z.string(), role: roleSchema, employeeId: z.number().nullable() }),
});

export const meSchema = z.object({
  id: z.number(), username: z.string().nullish(), email: z.string(), role: roleSchema, lastLoginAt: z.string().nullable(),
  employee: z.object({ id: z.number(), employeeCode: z.string(), firstName: z.string(), lastName: z.string(), workEmail: z.string(), status: z.string(), departmentId: z.number().nullable(), managerId: z.number().nullable() }).nullable(),
});
export type Me = z.infer<typeof meSchema>;

export const employeeSchema = z.object({
  id: z.number(), employeeCode: z.string(), firstName: z.string(), middleName: z.string().nullable(), lastName: z.string(), fullName: z.string(),
  workEmail: z.string(), phone: z.string().nullable(), status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']), designation: idName.nullable(), jobTitle: z.string().nullable(),
  department: idName.nullable(), team: idName.nullable(), manager: z.object({ id: z.number(), employeeCode: z.string(), name: z.string() }).nullable(),
  workLocation: z.string().nullable(), joiningDate: z.string(), profilePictureUrl: z.string().nullable(),
  // present for admins and the employee themself only
  personalEmail: z.string().nullable().optional(), dateOfBirth: z.string().nullable().optional(), gender: z.string().nullable().optional(),
  address: z.object({ line: z.string().nullable(), city: z.string().nullable(), state: z.string().nullable(), country: z.string().nullable(), postalCode: z.string().nullable() }).optional(),
  emergencyContact: z.object({ name: z.string().nullable(), phone: z.string().nullable(), relation: z.string().nullable() }).optional(),
  probationEndDate: z.string().nullable().optional(), exitDate: z.string().nullable().optional(),
  compensation: z.object({ salary: z.number().nullable(), salaryCurrency: z.string().nullable(), bonusTarget: z.number().nullable() }).optional(),
  account: z.object({ userId: z.number(), role: roleSchema }).nullable().optional(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const departmentSchema = z.object({
  id: z.number(), code: z.string(), name: z.string(), description: z.string().nullable(), isActive: z.boolean(),
  headEmployeeId: z.number().nullable(), headName: z.string().nullable(), headcount: z.number(),
});
export type Department = z.infer<typeof departmentSchema>;
export const designationSchema = z.object({ id: z.number(), name: z.string(), description: z.string().nullable(), jobLevel: z.number(), isActive: z.boolean(), headcount: z.number() });
export type Designation = z.infer<typeof designationSchema>;

export const jobHistorySchema = z.object({
  id: z.number(), changeType: z.string(), effectiveDate: z.string(), notes: z.string().nullable(),
  fromJobTitle: z.string().nullable(), toJobTitle: z.string().nullable(), fromDesignation: z.string().nullable(), toDesignation: z.string().nullable(),
  fromDepartment: z.string().nullable(), toDepartment: z.string().nullable(), fromManager: z.string().nullable(), toManager: z.string().nullable(),
});
export type JobHistoryEntry = z.infer<typeof jobHistorySchema>;

export const attendanceSchema = z.object({
  id: z.number(), employeeId: z.number(), employeeCode: z.string(), employeeName: z.string(), department: idName.nullable(), workDate: z.string(),
  checkInAt: z.string().nullable(), checkOutAt: z.string().nullable(), workingHours: z.number().nullable(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF']), workMode: z.string().nullable(), remarks: z.string().nullable(),
});
export type AttendanceRecord = z.infer<typeof attendanceSchema>;

export const leaveTypeSchema = z.object({
  id: z.number(), code: z.string(), name: z.string(), description: z.string().nullable(), isPaid: z.boolean(), requiresDocument: z.boolean(), isActive: z.boolean(),
  policy: z.object({ annualEntitlement: z.number(), carryForwardMax: z.number(), allowHalfDay: z.boolean(), maxConsecutiveDays: z.number().nullable() }).nullable(),
});
export type LeaveType = z.infer<typeof leaveTypeSchema>;
export const leaveBalancesSchema = z.object({
  employeeId: z.number(), year: z.number(),
  balances: z.array(z.object({ leaveTypeId: z.number(), leaveTypeCode: z.string(), leaveTypeName: z.string(), year: z.number(), entitled: z.number(), adjusted: z.number(), used: z.number(), available: z.number() })),
});
export type LeaveBalances = z.infer<typeof leaveBalancesSchema>;
export const leaveRequestSchema = z.object({
  id: z.number(), employeeId: z.number(), employeeCode: z.string(), employeeName: z.string(), leaveType: z.object({ id: z.number(), code: z.string(), name: z.string() }),
  startDate: z.string(), endDate: z.string(), dayPart: z.string(), days: z.number(), reason: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']), decidedBy: z.number().nullable(), decidedAt: z.string().nullable(), decisionNote: z.string().nullable(),
  cancelledAt: z.string().nullable(), documentCount: z.number(), createdAt: z.string(),
  documents: z.array(z.object({ id: z.number(), fileName: z.string(), mimeType: z.string(), sizeBytes: z.number() })).optional(),
});
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

export const holidaySchema = z.object({ id: z.number(), holidayDate: z.string(), name: z.string(), location: z.string(), isOptional: z.boolean() });
export type Holiday = z.infer<typeof holidaySchema>;

export const notificationSchema = z.object({
  id: z.number(), type: z.string(), title: z.string(), message: z.string(), refType: z.string().nullable(), refId: z.number().nullable(), isRead: z.boolean(), createdAt: z.string(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

const eventPerson = z.object({ employeeId: z.number(), employeeCode: z.string(), name: z.string(), date: z.string() });
export const dashboardSchema = z.object({
  asOf: z.string(), employees: z.object({ total: z.number(), active: z.number(), inactive: z.number() }),
  headcountByDepartment: z.array(z.object({ departmentId: z.number(), department: z.string(), headcount: z.number() })),
  attendanceToday: z.record(z.string(), z.number()), onLeaveToday: z.number(),
  leaveThisYear: z.record(z.string(), z.object({ requests: z.number(), days: z.number() })), pendingLeaveApprovals: z.number(),
  upcomingBirthdays: z.array(eventPerson), upcomingAnniversaries: z.array(eventPerson),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export interface OrgNode {
  id: number; employeeCode: string; name: string; workEmail: string; designation: string | null; jobTitle: string | null;
  department: { id: number; name: string } | null; managerId: number | null; profilePictureUrl: string | null; directReportCount: number; subordinates: OrgNode[];
}
export const orgNodeSchema: z.ZodType<OrgNode> = z.lazy(() =>
  z.object({
    id: z.number(), employeeCode: z.string(), name: z.string(), workEmail: z.string(), designation: z.string().nullable(), jobTitle: z.string().nullable(),
    department: idName.nullable(), managerId: z.number().nullable(), profilePictureUrl: z.string().nullable(), directReportCount: z.number(), subordinates: z.array(orgNodeSchema),
  }),
);
export const orgChartSchema = z.object({ roots: z.array(orgNodeSchema), totalNodes: z.number() });
export const reportingChainSchema = z.object({
  employee: z.object({ id: z.number(), name: z.string() }).passthrough(),
  chain: z.array(z.object({ level: z.number(), id: z.number(), name: z.string(), jobTitle: z.string().nullable() }).passthrough()),
});

export const registrationOptionsSchema = z.object({ departments: z.array(idName), designations: z.array(idName) });
export const registrationResultSchema = z.object({ id: z.number(), employeeId: z.number(), employeeCode: z.string(), username: z.string(), email: z.string(), role: roleSchema });
