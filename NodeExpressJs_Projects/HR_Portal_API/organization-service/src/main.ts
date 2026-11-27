import { bootService } from '@hr/common';
import { orgConfig } from './config';
import { orgConsumers } from './consumers';
import { organizationRoutes } from './routes';

void bootService({
  name: 'hr-organization-service', port: orgConfig.port, database: orgConfig.database,
  requiredTables: ['organizations', 'business_units', 'departments', 'designations', 'job_grades', 'locations', 'reporting_lines', 'org_employee_nodes', 'audit_history', 'outbox_events', 'processed_events'],
  mount: organizationRoutes, consumers: orgConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
