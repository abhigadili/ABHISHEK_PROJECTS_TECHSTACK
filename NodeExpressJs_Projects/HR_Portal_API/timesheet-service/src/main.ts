import { bootService } from '@hr/common';
import { timesheetConfig } from './config';
import { timesheetConsumers } from './consumers';
import { timesheetRoutes } from './routes';

void bootService({
  name: 'hr-timesheet-service', port: timesheetConfig.port, database: timesheetConfig.database,
  requiredTables: ['timesheets', 'timesheet_entries', 'timesheet_tasks', 'timesheet_history', 'timesheet_employees', 'audit_history', 'outbox_events', 'processed_events'],
  mount: timesheetRoutes, consumers: timesheetConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
