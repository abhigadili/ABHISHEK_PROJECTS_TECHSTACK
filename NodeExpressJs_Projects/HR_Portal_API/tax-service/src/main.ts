import { bootService } from '@hr/common';
import { taxConfig } from './config';
import { taxConsumers } from './consumers';
import { taxRoutes } from './routes';

void bootService({
  name: 'hr-tax-service', port: taxConfig.port, database: taxConfig.database,
  requiredTables: ['tax_rules', 'tax_declarations', 'investment_declarations', 'tax_proofs', 'tax_declaration_history', 'tax_computations', 'monthly_tds', 'tax_documents', 'tax_employees', 'audit_history', 'outbox_events', 'processed_events'],
  mount: taxRoutes, consumers: taxConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
