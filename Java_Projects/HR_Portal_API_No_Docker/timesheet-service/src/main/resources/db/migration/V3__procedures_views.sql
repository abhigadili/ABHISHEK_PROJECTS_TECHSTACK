ALTER TABLE timesheet_entries ADD CONSTRAINT chk_entry_hours CHECK (hours > 0 AND hours <= 24);
ALTER TABLE timesheets ADD CONSTRAINT chk_timesheet_hours CHECK (total_hours >= 0 AND billable_hours >= 0 AND billable_hours <= total_hours);
ALTER TABLE timesheet_entries ADD CONSTRAINT fk_entry_timesheet FOREIGN KEY (timesheet_id) REFERENCES timesheets (id);
ALTER TABLE timesheet_history ADD CONSTRAINT fk_ts_history_timesheet FOREIGN KEY (timesheet_id) REFERENCES timesheets (id);

DELIMITER $$

-- Employee work-hour summary: APPROVED hours per project in a period (billable / total).
CREATE PROCEDURE sp_timesheet_summary(IN p_employee_id VARCHAR(36), IN p_from DATE, IN p_to DATE)
    SQL SECURITY INVOKER READS SQL DATA
BEGIN
  SELECT e.project_id, SUM(e.hours) AS total_hours, SUM(CASE WHEN e.billable = 1 THEN e.hours ELSE 0 END) AS billable_hours
  FROM timesheet_entries e JOIN timesheets t ON t.id = e.timesheet_id
  WHERE e.employee_id = p_employee_id AND t.status = 'APPROVED' AND e.work_date BETWEEN p_from AND p_to
  GROUP BY e.project_id
  ORDER BY total_hours DESC;
END$$

DELIMITER ;

-- Timesheet summary: one row per employee week with status and hours (no free-text fields).
CREATE SQL SECURITY INVOKER VIEW vw_timesheet_summary AS
SELECT t.id AS timesheet_id, t.employee_id, t.week_start, DATE_ADD(t.week_start, INTERVAL 6 DAY) AS week_end, t.status,
       t.total_hours, t.billable_hours, (t.total_hours - t.billable_hours) AS non_billable_hours,
       COUNT(DISTINCT e.project_id) AS project_count, t.submitted_at, t.decided_at, t.resubmission_count
FROM timesheets t LEFT JOIN timesheet_entries e ON e.timesheet_id = t.id
GROUP BY t.id, t.employee_id, t.week_start, t.status, t.total_hours, t.billable_hours, t.submitted_at, t.decided_at, t.resubmission_count;
