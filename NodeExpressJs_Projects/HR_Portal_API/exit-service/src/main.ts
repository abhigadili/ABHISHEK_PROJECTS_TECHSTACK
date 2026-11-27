import { bootService } from '@hr/common';
import { exitConfig } from './config';
import { exitRoutes } from './routes';

void bootService({
  name: 'hr-exit-service', port: exitConfig.port, database: exitConfig.database,
  requiredTables: ['resignations', 'exit_tasks', 'exit_history', 'exit_interviews', 'exit_interview_forms', 'exit_policy', 'settlements', 'settlement_lines', 'audit_history', 'outbox_events'],
  mount: exitRoutes,
}).catch((e) => { console.error(e); process.exit(1); });
