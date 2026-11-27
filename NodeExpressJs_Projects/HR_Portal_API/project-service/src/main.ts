import { bootService } from '@hr/common';
import { projectConfig } from './config';
import { projectConsumers } from './consumers';
import { projectRoutes } from './routes';

void bootService({
  name: 'hr-project-service', port: projectConfig.port, database: projectConfig.database,
  requiredTables: ['customers', 'customer_contacts', 'projects', 'project_allocations', 'project_history', 'audit_history', 'outbox_events', 'processed_events'],
  mount: projectRoutes, consumers: projectConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
