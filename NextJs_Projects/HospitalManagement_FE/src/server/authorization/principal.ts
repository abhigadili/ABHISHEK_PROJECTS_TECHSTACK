import type { RoleKey } from '@/lib/constants/rbac';
/** The authenticated caller, derived from the verified access token. */
export interface Principal { userId: number; role: RoleKey; hospitalId: number | null; patientId: number | null; doctorId: number | null; name: string; email: string }
