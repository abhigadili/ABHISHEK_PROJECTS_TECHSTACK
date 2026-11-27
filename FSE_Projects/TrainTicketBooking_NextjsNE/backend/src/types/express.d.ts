import type { RoleKey } from '../constants/rbac';
declare global {
  namespace Express {
    interface Request { user?: { id: number; roles: RoleKey[] }; requestId?: string }
  }
}
export {};
