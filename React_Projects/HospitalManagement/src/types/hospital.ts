export interface Hospital {
  id: number;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

export interface HospitalInput {
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface Department {
  id: number;
  hospitalId: number;
  name: string;
  description: string | null;
  active: boolean;
}

export interface DepartmentInput {
  name: string;
  description?: string;
}
