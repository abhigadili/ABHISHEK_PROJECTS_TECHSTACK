-- 04_create_views.sql
-- Only views the application actually queries.
USE ems_expressjs;

-- Available balance per employee / leave type / year.
CREATE OR REPLACE VIEW v_leave_balance_available AS
SELECT lb.id AS balance_id, lb.employee_id, lb.leave_type_id, lt.code AS leave_type_code,
       lt.name AS leave_type_name, lb.year, lb.entitled, lb.adjusted, lb.used,
       (lb.entitled + lb.adjusted - lb.used) AS available
FROM leave_balances lb
JOIN leave_types lt ON lt.id = lb.leave_type_id;

-- Headcount per department (active employees only).
CREATE OR REPLACE VIEW v_department_headcount AS
SELECT d.id AS department_id, d.code, d.name, d.is_active,
       COUNT(e.id) AS headcount
FROM departments d
LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'ACTIVE'
GROUP BY d.id, d.code, d.name, d.is_active;
