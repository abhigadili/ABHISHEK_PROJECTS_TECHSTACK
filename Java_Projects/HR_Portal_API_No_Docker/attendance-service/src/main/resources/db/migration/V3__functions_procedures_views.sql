ALTER TABLE attendance_records ADD CONSTRAINT chk_attendance_minutes CHECK (worked_minutes >= 0 AND late_minutes >= 0 AND early_departure_minutes >= 0 AND overtime_minutes >= 0);
ALTER TABLE attendance_records ADD CONSTRAINT chk_attendance_punches CHECK (check_out IS NULL OR check_in IS NULL OR check_out >= check_in);
ALTER TABLE shifts ADD CONSTRAINT chk_shift_thresholds CHECK (half_day_minutes <= full_day_minutes AND full_day_minutes <= standard_minutes);
ALTER TABLE wfh_requests ADD CONSTRAINT chk_wfh_dates CHECK (to_date >= from_date);

DELIMITER $$

-- Mon-Fri days between two dates (inclusive); reusable working-days calculation.
CREATE FUNCTION fn_working_days(p_from DATE, p_to DATE) RETURNS INT
    DETERMINISTIC NO SQL
BEGIN
  DECLARE v_total INT;
  DECLARE v_days INT;
  DECLARE v_extra INT;
  DECLARE v_dow INT;
  DECLARE i INT DEFAULT 0;
  IF p_to < p_from THEN RETURN 0; END IF;
  SET v_total = DATEDIFF(p_to, p_from) + 1;
  SET v_days = FLOOR(v_total / 7) * 5;
  SET v_extra = MOD(v_total, 7);
  SET v_dow = WEEKDAY(p_from);
  WHILE i < v_extra DO
    IF MOD(v_dow + i, 7) < 5 THEN SET v_days = v_days + 1; END IF;
    SET i = i + 1;
  END WHILE;
  RETURN v_days;
END$$

-- Overtime minutes: only when the worked time exceeds the standard day by more than the threshold.
CREATE FUNCTION fn_overtime_minutes(p_worked INT, p_standard INT, p_threshold INT) RETURNS INT
    DETERMINISTIC NO SQL
BEGIN
  IF p_worked > p_standard + p_threshold THEN RETURN p_worked - p_standard; END IF;
  RETURN 0;
END$$

-- Monthly attendance summary: classifies every day of the month, stores the result (upsert) and returns it.
-- Day precedence: worked (attendance record) > holiday > weekly off > approved leave > absent (past working day) > not applicable.
CREATE PROCEDURE sp_monthly_attendance_summary(IN p_employee_id VARCHAR(36), IN p_year INT, IN p_month INT, IN p_location_id VARCHAR(36))
    SQL SECURITY INVOKER MODIFIES SQL DATA
BEGIN
  DECLARE v_start DATE;
  DECLARE v_end DATE;
  DECLARE v_today DATE;
  DECLARE v_joining DATE;
  DECLARE v_weekly_offs VARCHAR(40);

  SET v_start = STR_TO_DATE(CONCAT(p_year, '-', p_month, '-01'), '%Y-%m-%d');
  SET v_end = LAST_DAY(v_start);
  SET v_today = UTC_DATE();

  SELECT s.weekly_offs INTO v_weekly_offs
  FROM shift_assignments a JOIN shifts s ON s.id = a.shift_id
  WHERE a.employee_id = p_employee_id AND a.effective_from <= v_end AND (a.effective_to IS NULL OR a.effective_to >= v_end)
  ORDER BY a.effective_from DESC LIMIT 1;
  IF v_weekly_offs IS NULL THEN
    SELECT weekly_offs INTO v_weekly_offs FROM shifts WHERE is_default = 1 AND deleted = 0 LIMIT 1;
  END IF;
  SET v_weekly_offs = COALESCE(v_weekly_offs, 'SAT,SUN');
  SELECT joining_date INTO v_joining FROM attendance_employees WHERE employee_id = p_employee_id;

  INSERT INTO monthly_attendance_summary
    (id, employee_id, summary_year, summary_month, total_days, working_days, present_days, half_days, absent_days, leave_days, holidays, weekly_offs,
     wfh_days, missing_punches, late_count, late_minutes, early_count, worked_minutes, overtime_minutes, generated_at, created_at, updated_at, created_by, updated_by)
  WITH RECURSIVE d AS (
    SELECT v_start AS dt UNION ALL SELECT dt + INTERVAL 1 DAY FROM d WHERE dt < v_end
  ), cls AS (
    SELECT d.dt,
      CASE
        WHEN v_joining IS NOT NULL AND d.dt < v_joining THEN 'PRE_JOIN'
        WHEN a.id IS NOT NULL AND a.status IN ('PRESENT', 'HALF_DAY', 'MISSING_PUNCH') THEN a.status
        WHEN h.holiday_date IS NOT NULL THEN 'HOLIDAY'
        WHEN FIND_IN_SET(UPPER(LEFT(DAYNAME(d.dt), 3)), v_weekly_offs) > 0 THEN 'WEEKLY_OFF'
        WHEN l.leave_date IS NOT NULL THEN 'LEAVE'
        WHEN d.dt < v_today THEN 'ABSENT'
        ELSE 'UPCOMING'
      END AS day_type,
      a.work_mode, COALESCE(a.late_minutes, 0) AS late_min, COALESCE(a.early_departure_minutes, 0) AS early_min,
      COALESCE(a.worked_minutes, 0) AS worked_min, COALESCE(a.overtime_minutes, 0) AS ot_min
    FROM d
    LEFT JOIN attendance_records a ON a.employee_id = p_employee_id AND a.work_date = d.dt
    LEFT JOIN (SELECT leave_date FROM approved_leave_days WHERE employee_id = p_employee_id GROUP BY leave_date) l ON l.leave_date = d.dt
    LEFT JOIN (SELECT holiday_date FROM holiday_snapshots WHERE location_id IS NULL OR location_id = p_location_id GROUP BY holiday_date) h ON h.holiday_date = d.dt
  )
  SELECT UUID(), p_employee_id, p_year, p_month, DAY(v_end),
         SUM(day_type NOT IN ('HOLIDAY', 'WEEKLY_OFF', 'PRE_JOIN')),
         SUM(day_type = 'PRESENT'), SUM(day_type = 'HALF_DAY'), SUM(day_type = 'ABSENT'), SUM(day_type = 'LEAVE'),
         SUM(day_type = 'HOLIDAY'), SUM(day_type = 'WEEKLY_OFF'),
         SUM(work_mode = 'WFH' AND day_type IN ('PRESENT', 'HALF_DAY')), SUM(day_type = 'MISSING_PUNCH'),
         SUM(late_min > 0), SUM(late_min), SUM(early_min > 0), SUM(worked_min), SUM(ot_min),
         UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'sp_monthly_attendance_summary', 'sp_monthly_attendance_summary'
  FROM cls
  ON DUPLICATE KEY UPDATE total_days = VALUES(total_days), working_days = VALUES(working_days), present_days = VALUES(present_days),
    half_days = VALUES(half_days), absent_days = VALUES(absent_days), leave_days = VALUES(leave_days), holidays = VALUES(holidays),
    weekly_offs = VALUES(weekly_offs), wfh_days = VALUES(wfh_days), missing_punches = VALUES(missing_punches), late_count = VALUES(late_count),
    late_minutes = VALUES(late_minutes), early_count = VALUES(early_count), worked_minutes = VALUES(worked_minutes),
    overtime_minutes = VALUES(overtime_minutes), generated_at = VALUES(generated_at), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by);

  SELECT total_days, working_days, present_days, half_days, absent_days, leave_days, holidays, weekly_offs, wfh_days, missing_punches,
         late_count, late_minutes, early_count, worked_minutes, overtime_minutes, generated_at
  FROM monthly_attendance_summary
  WHERE employee_id = p_employee_id AND summary_year = p_year AND summary_month = p_month;
END$$

DELIMITER ;

-- Monthly summary view (no personal data): attendance percentage over the working days of the month.
CREATE SQL SECURITY INVOKER VIEW vw_monthly_attendance_summary AS
SELECT employee_id, summary_year, summary_month, working_days, present_days, half_days, absent_days, leave_days, holidays, weekly_offs,
       wfh_days, missing_punches, late_count, overtime_minutes,
       fn_working_days(STR_TO_DATE(CONCAT(summary_year, '-', summary_month, '-01'), '%Y-%m-%d'),
                       LAST_DAY(STR_TO_DATE(CONCAT(summary_year, '-', summary_month, '-01'), '%Y-%m-%d'))) AS weekdays_in_month,
       CASE WHEN working_days = 0 THEN NULL ELSE ROUND(100 * (present_days + 0.5 * half_days + leave_days) / working_days, 1) END AS attendance_percent,
       generated_at
FROM monthly_attendance_summary;

-- Default shift (general 09:30 - 18:30, Sat/Sun off)
INSERT INTO shifts (id, code, name, start_time, end_time, grace_minutes, standard_minutes, full_day_minutes, half_day_minutes, overtime_threshold_minutes,
                    weekly_offs, is_default, active, deleted, created_at, updated_at, created_by, updated_by)
VALUES (UUID(), 'GEN', 'General Shift', '09:30:00', '18:30:00', 15, 480, 420, 240, 30, 'SAT,SUN', 1, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');
