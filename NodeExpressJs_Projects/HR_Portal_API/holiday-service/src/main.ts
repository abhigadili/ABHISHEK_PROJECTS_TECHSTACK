import { bootService } from '@hr/common';
import { holidayConfig } from './config';
import { holidayRoutes } from './routes';

void bootService({
  name: 'hr-holiday-service', port: holidayConfig.port, database: holidayConfig.database,
  requiredTables: ['holidays', 'holiday_scopes', 'holiday_years', 'audit_history', 'outbox_events'],
  mount: holidayRoutes,
}).catch((e) => { console.error(e); process.exit(1); });
