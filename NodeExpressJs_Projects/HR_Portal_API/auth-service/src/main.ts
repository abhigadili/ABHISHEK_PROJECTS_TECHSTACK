import { bootService } from '@hr/common';
import { authConfig } from './config';
import { authConsumers } from './consumers';
import { AuthService } from './services/auth.service';
import { publicRoutes, securedRoutes } from './routes';

void bootService({
  name: 'hr-auth-service',
  port: authConfig.port,
  database: authConfig.database,
  requiredTables: ['user_accounts', 'roles', 'permissions', 'user_roles', 'role_permissions', 'refresh_tokens', 'password_reset_tokens', 'audit_history', 'outbox_events', 'processed_events'],
  mountPublic: publicRoutes,
  mount: securedRoutes,
  consumers: authConsumers,
  onStart: async (db) => {
    await new AuthService(db).ensureBootstrapAdmin(process.env.HR_BOOTSTRAP_ADMIN_USERNAME, process.env.HR_BOOTSTRAP_ADMIN_EMAIL, process.env.HR_BOOTSTRAP_ADMIN_PASSWORD);
  },
}).catch((e) => { console.error(e); process.exit(1); });
