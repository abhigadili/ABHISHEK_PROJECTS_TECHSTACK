import { bootService } from '@hr/common';
import { notificationConfig } from './config';
import { notificationConsumers } from './consumers';
import { notificationRoutes } from './routes';

void bootService({
  name: 'hr-notification-service', port: notificationConfig.port, database: notificationConfig.database,
  requiredTables: ['notifications', 'notification_templates', 'email_settings', 'event_history', 'employee_contacts', 'audit_history', 'outbox_events', 'processed_events'],
  mount: notificationRoutes, consumers: notificationConsumers,
}).catch((e) => { console.error(e); process.exit(1); });
