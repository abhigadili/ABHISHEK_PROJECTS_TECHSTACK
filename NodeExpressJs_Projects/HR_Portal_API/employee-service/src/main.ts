import { bootService } from '@hr/common';
import { employeeConfig } from './config';
import { employeeConsumers } from './consumers';
import { employeeRoutes } from './routes';

void bootService({
  name: 'hr-employee-service', port: employeeConfig.port, database: employeeConfig.database,
  requiredTables: ['employees', 'employee_addresses', 'emergency_contacts', 'employee_education', 'employee_experience', 'employee_bank_details', 'employment_history', 'profile_change_log',
    'employee_status_history', 'employee_sequence', 'audit_history', 'outbox_events', 'processed_events'],
  mount: employeeRoutes, consumers: employeeConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
