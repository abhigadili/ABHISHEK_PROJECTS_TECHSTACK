import { bootService, withLock, logger, today } from '@hr/common';
import { leaveConfig } from './config';
import { leaveConsumers } from './consumers';
import { leaveRoutes } from './routes';
import { BalanceService } from './services/balance.service';

void bootService({
  name: 'hr-leave-service', port: leaveConfig.port, database: leaveConfig.database,
  requiredTables: ['leave_types', 'leave_policies', 'leave_policy_entitlements', 'leave_balances', 'leave_balance_history', 'leave_applications', 'leave_approvals', 'leave_comments', 'leave_attachments',
    'leave_employees', 'leave_run_log', 'audit_history', 'outbox_events', 'processed_events'],
  mount: leaveRoutes, consumers: leaveConsumers,
  onStart: async (db) => {
    // daily check: run the current month's accrual once (idempotent; guarded by a distributed lock)
    const svc = new BalanceService(db);
    const tick = async (): Promise<void> => {
      const d = today();
      await withLock(`leave-accrual-scheduler:${d}`, 60000, async () => {
        const runKey = `accrual:${d.slice(0, 7)}`;
        if (!(await db.one('SELECT run_key FROM leave_run_log WHERE run_key = ?', [runKey]))) await svc.runAccrual(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 'scheduler');
      }).catch((e) => logger.warn({ err: e.message }, 'scheduled accrual skipped'));
    };
    setTimeout(() => void tick(), 15000).unref();
    setInterval(() => void tick(), 6 * 3600 * 1000).unref();
  },
}).catch((e) => { console.error(e); process.exit(1); });
