import { Pipe, PipeTransform } from '@angular/core';
import { EmployeeStatus, EmploymentType } from '../../core/models/employee.models';
import { LeaveStatus } from '../../core/models/leave.models';
import { parseServerDateTime } from '../utils/dates';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|_)([a-z])/g, (_m, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`);

/** ACTIVE → "Active". Pure + stateless: only formats a label, no business logic. */
@Pipe({ name: 'employeeStatus' })
export class EmployeeStatusPipe implements PipeTransform {
  transform(value: EmployeeStatus | string | null | undefined): string {
    return value ? titleCase(value) : '—';
  }
}

/** FULL_TIME → "Full Time". */
@Pipe({ name: 'employmentType' })
export class EmploymentTypePipe implements PipeTransform {
  transform(value: EmploymentType | string | null | undefined): string {
    return value ? titleCase(value) : '—';
  }
}

const LEAVE_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

@Pipe({ name: 'leaveStatus' })
export class LeaveStatusPipe implements PipeTransform {
  transform(value: LeaveStatus | string | null | undefined): string {
    return value ? (LEAVE_LABELS[value as LeaveStatus] ?? titleCase(value)) : '—';
  }
}

export interface NameParts {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}

/** Formats a person's name: 'full' (default), 'lastFirst' ("Engineer, Eve"), or 'initials' ("EE"). */
@Pipe({ name: 'employeeName' })
export class EmployeeNamePipe implements PipeTransform {
  transform(p: NameParts | null | undefined, format: 'full' | 'lastFirst' | 'initials' = 'full'): string {
    if (!p) return '';
    const first = p.firstName?.trim() ?? '';
    const last = p.lastName?.trim() ?? '';
    switch (format) {
      case 'lastFirst':
        return [last, first].filter(Boolean).join(', ');
      case 'initials':
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || (p.fullName ?? '').slice(0, 2).toUpperCase();
      default:
        return p.fullName ?? [first, p.middleName?.trim(), last].filter(Boolean).join(' ');
    }
  }
}

/** 7.5 → "7h 30m", null → "—". */
@Pipe({ name: 'workingHours' })
export class WorkingHoursPipe implements PipeTransform {
  transform(hours: number | null | undefined): string {
    if (hours === null || hours === undefined || isNaN(hours)) return '—';
    const totalMinutes = Math.round(hours * 60);
    return `${Math.floor(totalMinutes / 60)}h ${`${totalMinutes % 60}`.padStart(2, '0')}m`;
  }
}

/** Server UTC timestamps ("2026-11-04 08:11:46" or ISO) → local date-time string. */
@Pipe({ name: 'serverDateTime' })
export class ServerDateTimePipe implements PipeTransform {
  transform(value: string | null | undefined, mode: 'datetime' | 'date' | 'time' = 'datetime'): string {
    const d = parseServerDateTime(value);
    if (!d) return '—';
    if (mode === 'date') return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    if (mode === 'time') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
