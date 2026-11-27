-- 10_database_validation_queries.sql
-- Integrity checks. Every query should return ZERO rows on a healthy database.
USE ems_expressjs;

-- Employees reporting to themselves
SELECT id, employee_code FROM employees WHERE manager_id = id;

-- Employees whose manager is missing/inactive
SELECT e.employee_code, e.manager_id FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
WHERE e.manager_id IS NOT NULL AND e.status = 'ACTIVE' AND (m.id IS NULL OR m.status <> 'ACTIVE');

-- Reporting cycles (an employee that is its own ancestor)
WITH RECURSIVE walk AS (
  SELECT id AS start_id, manager_id AS cur, 1 AS hops FROM employees WHERE manager_id IS NOT NULL
  UNION ALL
  SELECT w.start_id, e.manager_id, w.hops + 1 FROM walk w JOIN employees e ON e.id = w.cur
  WHERE e.manager_id IS NOT NULL AND w.hops < 50 AND w.cur <> w.start_id
)
SELECT DISTINCT start_id FROM walk WHERE cur = start_id;

-- Users with no/invalid role
SELECT u.id, u.email FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE r.id IS NULL;

-- Leave balances where ledger does not match used+adjusted+entitled
SELECT lb.id FROM leave_balances lb
LEFT JOIN (SELECT leave_balance_id, SUM(amount) s FROM leave_balance_transactions GROUP BY leave_balance_id) t
  ON t.leave_balance_id = lb.id
WHERE ABS(COALESCE(t.s,0) - (lb.entitled + lb.adjusted - lb.used)) > 0.001;

-- Approved leave with no deduction record (paid types with a policy)
SELECT lr.id FROM leave_requests lr
JOIN leave_policies lp ON lp.leave_type_id = lr.leave_type_id
LEFT JOIN leave_balance_transactions t ON t.leave_request_id = lr.id AND t.type = 'DEDUCTION'
WHERE lr.status = 'APPROVED' AND t.id IS NULL;

-- Overlapping active leave requests for one employee
SELECT a.id, b.id FROM leave_requests a JOIN leave_requests b
  ON a.employee_id = b.employee_id AND a.id < b.id
 AND a.status IN ('PENDING','APPROVED') AND b.status IN ('PENDING','APPROVED')
 AND a.start_date <= b.end_date AND b.start_date <= a.end_date;

-- Attendance with check-out earlier than check-in
SELECT id FROM attendance WHERE check_out_at < check_in_at;

-- Department heads who are not in that department
SELECT d.id, d.code FROM departments d JOIN employees e ON e.id = d.head_employee_id
WHERE e.department_id <> d.id;
