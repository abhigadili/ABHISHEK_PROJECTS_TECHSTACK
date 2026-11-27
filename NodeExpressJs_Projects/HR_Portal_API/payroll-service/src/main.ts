import { bootService } from '@hr/common';
import { payrollConfig } from './config';
import { payrollRoutes } from './routes';

void bootService({
  name: 'hr-payroll-service', port: payrollConfig.port, database: payrollConfig.database,
  requiredTables: ['salary_components', 'salary_structures', 'salary_structure_components', 'employee_salaries', 'salary_revisions', 'payroll_runs', 'payroll_entries', 'payroll_entry_lines',
    'payroll_adjustments', 'loans', 'loan_deductions', 'payslips', 'payroll_config', 'audit_history', 'outbox_events'],
  mount: payrollRoutes,
}).catch((e) => { console.error(e); process.exit(1); });
