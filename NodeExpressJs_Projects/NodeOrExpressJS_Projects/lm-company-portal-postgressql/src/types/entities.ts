// ============================================================
// WHAT: Plain TypeScript interfaces for PostgreSQL row types
// WHY:  No Mongoose Document needed. PostgreSQL rows map directly
//       to plain objects. The `pg` library returns plain JS objects.
// Interview Tip: With SQL ORMs (TypeORM, Sequelize) you'd use
//               decorated classes. With raw pg, plain interfaces suffice.
// ============================================================

export interface IUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  role: string;
  is_active: boolean;
  provider?: string;
  provider_id?: string;
  avatar?: string;
  password_reset_token?: string;
  password_reset_expires?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ICompany {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  description?: string;
  website?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IDepartment {
  id: string;
  name: string;
  description?: string;
  company_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  department_id: string;
  designation: string;
  manager_id?: string;
  salary: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IRoom {
  id: string;
  room_name: string;
  capacity: number;
  floor: number;
  building: string;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IMeeting {
  id: string;
  title: string;
  room_id: string;
  booked_by: string;
  start_time: Date;
  end_time: Date;
  status: 'scheduled' | 'cancelled' | 'completed';
  created_at: Date;
  updated_at: Date;
}

export interface IAuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource: string;
  resource_id?: string;
  changes?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  created_at: Date;
}
