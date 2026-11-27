import { bootService, logger } from '@hr/common';
import { attendanceConfig } from './config';
import { attendanceConsumers } from './consumers';
import { attendanceRoutes } from './routes';
import { AttendanceService } from './services/attendance.service';
import { ShiftService } from './services/shift.service';

void bootService({
  name: 'hr-attendance-service', port: attendanceConfig.port, database: attendanceConfig.database,
  requiredTables: ['attendance_records', 'attendance_corrections', 'attendance_employees', 'shifts', 'shift_assignments', 'wfh_requests', 'holiday_snapshots', 'approved_leave_days',
    'monthly_attendance_summary', 'audit_history', 'outbox_events', 'processed_events'],
  mount: attendanceRoutes, consumers: attendanceConsumers,
  onStart: async (db) => {
    const att = new AttendanceService(db); const shifts = new ShiftService(db);
    setTimeout(() => void shifts.syncHolidays(new Date().getUTCFullYear()).catch((e) => logger.warn({ err: e.message }, 'holiday sync skipped')), 20000).unref();
    setInterval(() => void att.markMissingPunches().catch(() => undefined), 3 * 3600 * 1000).unref();
  },
}).catch((e) => { console.error(e); process.exit(1); });
