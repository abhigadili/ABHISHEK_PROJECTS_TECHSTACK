ALTER TABLE rpt_facts ADD CONSTRAINT chk_fact_type CHECK (fact_type IN ('LEAVE', 'ATTENDANCE', 'PAYROLL', 'TAX', 'TIMESHEET', 'REVIEW', 'EXIT', 'ALLOCATION'));

-- Headcount by department and status straight from the Kafka-maintained employee table (no personal data).
CREATE SQL SECURITY INVOKER VIEW vw_headcount_by_department AS
SELECT department_id, status, COUNT(*) AS employees
FROM rpt_employees GROUP BY department_id, status;

-- Leave utilisation per type and month from the leave facts.
CREATE SQL SECURITY INVOKER VIEW vw_leave_utilization AS
SELECT period_key AS month, category AS leave_type, status, COUNT(*) AS applications, SUM(num_a) AS days
FROM rpt_facts WHERE fact_type = 'LEAVE' GROUP BY period_key, category, status;
