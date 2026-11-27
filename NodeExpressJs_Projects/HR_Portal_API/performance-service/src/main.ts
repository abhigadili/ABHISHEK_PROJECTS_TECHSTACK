import { bootService } from '@hr/common';
import { perfConfig } from './config';
import { perfConsumers } from './consumers';
import { performanceRoutes } from './routes';

void bootService({
  name: 'hr-performance-service', port: perfConfig.port, database: perfConfig.database,
  requiredTables: ['evaluation_forms', 'form_questions', 'review_cycles', 'performance_reviews', 'review_answers', 'review_history', 'goals', 'key_results', 'feedback', 'perf_employees', 'audit_history', 'outbox_events', 'processed_events'],
  mount: performanceRoutes, consumers: perfConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
