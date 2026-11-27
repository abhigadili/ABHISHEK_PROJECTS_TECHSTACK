-- 09_sample_queries_and_reports.sql
-- Read-only example queries. Run individually.
USE ems_expressjs;

-- 1. Employee search (name / email / code)
SELECT employee_code, CONCAT(first_name,' ',last_name) AS name, work_email, job_title
FROM employees
WHERE status = 'ACTIVE'
  AND (first_name LIKE '%an%' OR last_name LIKE '%an%' OR work_email LIKE '%an%' OR employee_code LIKE '%an%')
ORDER BY last_name, first_name LIMIT 20;

-- 2. Organization hierarchy (full tree, depth-limited, cycle-safe)
WITH RECURSIVE tree AS (
  SELECT id, employee_code, first_name, last_name, manager_id, 0 AS depth,
         CAST(id AS CHAR(200)) AS path
  FROM employees WHERE manager_id IS NULL AND status = 'ACTIVE'
  UNION ALL
  SELECT e.id, e.employee_code, e.first_name, e.last_name, e.manager_id, t.depth + 1,
         CONCAT(t.path, ',', e.id)
  FROM employees e JOIN tree t ON e.manager_id = t.id
  WHERE e.status = 'ACTIVE' AND t.depth < 20 AND FIND_IN_SET(e.id, t.path) = 0
)
SELECT CONCAT(REPEAT('    ', depth), first_name, ' ', last_name) AS org_chart, employee_code, depth
FROM tree ORDER BY path;

-- 3. Reporting chain of one employee (up to the root)
WITH RECURSIVE chain AS (
  SELECT id, first_name, last_name, manager_id, 0 AS level FROM employees WHERE employee_code = 'EMP-1006'
  UNION ALL
  SELECT m.id, m.first_name, m.last_name, m.manager_id, c.level + 1
  FROM employees m JOIN chain c ON m.id = c.manager_id WHERE c.level < 20
)
SELECT level, first_name, last_name FROM chain ORDER BY level;

-- 4. Monthly attendance summary
SELECT e.employee_code, CONCAT(e.first_name,' ',e.last_name) AS name,
       SUM(a.status = 'PRESENT') AS present_days, SUM(a.status = 'HALF_DAY') AS half_days,
       SUM(a.status = 'ABSENT') AS absent_days, ROUND(SUM(a.working_hours),1) AS total_hours
FROM employees e
LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date BETWEEN '2026-10-01' AND '2026-10-31'
GROUP BY e.id ORDER BY e.employee_code;

-- 5. Leave balances for the current year
SELECT e.employee_code, v.leave_type_code, v.entitled, v.adjusted, v.used, v.available
FROM v_leave_balance_available v JOIN employees e ON e.id = v.employee_id
WHERE v.year = YEAR(CURDATE()) ORDER BY e.employee_code, v.leave_type_code;

-- 6. Headcount by department
SELECT * FROM v_department_headcount ORDER BY headcount DESC;

-- 7. Pending leave approvals by manager
SELECT m.employee_code AS manager, e.employee_code AS employee, lr.start_date, lr.end_date, lr.days
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
JOIN employees m ON m.id = e.manager_id
WHERE lr.status = 'PENDING' ORDER BY lr.start_date;
