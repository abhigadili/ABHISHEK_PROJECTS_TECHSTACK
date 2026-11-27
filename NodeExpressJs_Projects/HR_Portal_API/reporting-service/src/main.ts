import { bootService } from '@hr/common';
import { reportingConfig } from './config';
import { reportingConsumers } from './consumers';
import { reportingRoutes } from './routes';

void bootService({
  name: 'hr-reporting-service', port: reportingConfig.port, database: reportingConfig.database,
  requiredTables: ['rpt_employees', 'rpt_facts', 'audit_history', 'outbox_events', 'processed_events'],
  mount: reportingRoutes, consumers: reportingConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
