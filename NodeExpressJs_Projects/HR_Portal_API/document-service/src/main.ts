import { bootService, withLock, logger } from '@hr/common';
import { documentConfig } from './config';
import { documentConsumers } from './consumers';
import { documentRoutes } from './routes';
import { DocumentService } from './services/document.service';

void bootService({
  name: 'hr-document-service', port: documentConfig.port, database: documentConfig.database,
  requiredTables: ['documents', 'document_categories', 'document_permissions', 'document_history', 'audit_history', 'outbox_events', 'processed_events'],
  mount: documentRoutes, consumers: documentConsumers,
  onStart: async (db) => {
    const svc = new DocumentService(db);
    await svc.ensureCategories();
    const tick = () => void withLock('document-expiry-reminders', 60000, () => svc.remindExpiring()).catch((e) => logger.warn({ err: e.message }, 'expiry reminder skipped'));
    setTimeout(tick, 30000).unref(); setInterval(tick, 12 * 3600 * 1000).unref();
  },
}).catch((e) => { console.error(e); process.exit(1); });
