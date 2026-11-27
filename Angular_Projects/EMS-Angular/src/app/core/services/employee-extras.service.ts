import { Injectable, inject } from '@angular/core';
import { EmployeeExtras } from '../models/employee.models';
import { BROWSER_STORAGE } from '../tokens/tokens';

const key = (employeeId: number) => `ems.employeeExtras.${employeeId}`;
const EMPTY: EmployeeExtras = { education: [], experience: [], skills: [] };

/**
 * ⚠ BROWSER-ONLY storage. The existing Express backend has NO endpoints for education, work experience, skills or
 * certifications (documented in docs/backend-api-integration.md → "Missing APIs"). Until the proposed
 * `/employees/:id/education|experience|skills` endpoints exist, the forms keep these records here, per employee,
 * and every screen that shows them displays a visible notice. Nothing in this class is sent to the server.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeExtrasService {
  private readonly storage = inject(BROWSER_STORAGE);

  get(employeeId: number): EmployeeExtras {
    try {
      const raw = this.storage.getItem(key(employeeId));
      return raw ? ({ ...EMPTY, ...(JSON.parse(raw) as Partial<EmployeeExtras>) } as EmployeeExtras) : { ...EMPTY };
    } catch {
      return { ...EMPTY };
    }
  }

  save(employeeId: number, extras: EmployeeExtras): void {
    try {
      this.storage.setItem(key(employeeId), JSON.stringify(extras));
    } catch {
      /* storage full/unavailable: extras are best-effort until the backend supports them */
    }
  }
}

export const LOCAL_ONLY_NOTICE =
  'Stored in this browser only — the current backend has no education/experience/skills API (see docs/backend-api-integration.md).';
