-- Data quality
ALTER TABLE leave_applications ADD CONSTRAINT chk_leave_dates CHECK (to_date >= from_date);
ALTER TABLE leave_applications ADD CONSTRAINT chk_leave_days CHECK (days > 0);
ALTER TABLE leave_balances ADD CONSTRAINT chk_balance_non_negative CHECK (used >= 0 AND pending >= 0 AND encashed >= 0);

DELIMITER $$

-- Mon-Fri days between two dates (inclusive).
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
  SET v_dow = WEEKDAY(p_from);                     -- 0 = Monday ... 6 = Sunday (the leftover days start on the same weekday)
  WHILE i < v_extra DO
    IF MOD(v_dow + i, 7) < 5 THEN SET v_days = v_days + 1; END IF;
    SET i = i + 1;
  END WHILE;
  RETURN v_days;
END$$

-- Leave duration in days: weekdays minus holidays that fall on weekdays, minus half-day halves.
CREATE FUNCTION fn_leave_duration(p_from DATE, p_to DATE, p_half_start TINYINT, p_half_end TINYINT, p_holidays INT) RETURNS DECIMAL(5,1)
    DETERMINISTIC NO SQL
BEGIN
  DECLARE v_days DECIMAL(5,1);
  SET v_days = fn_working_days(p_from, p_to) - p_holidays;
  IF v_days < 0 THEN SET v_days = 0; END IF;
  IF p_from = p_to THEN
    IF (p_half_start = 1 OR p_half_end = 1) AND v_days > 0 THEN SET v_days = 0.5; END IF;
  ELSE
    IF p_half_start = 1 AND WEEKDAY(p_from) < 5 THEN SET v_days = v_days - 0.5; END IF;
    IF p_half_end = 1 AND WEEKDAY(p_to) < 5 THEN SET v_days = v_days - 0.5; END IF;
  END IF;
  IF v_days < 0 THEN SET v_days = 0; END IF;
  RETURN v_days;
END$$

-- Leave-balance transaction history: every change of a balance row is recorded by the database itself.
CREATE TRIGGER trg_leave_balance_history AFTER UPDATE ON leave_balances FOR EACH ROW
BEGIN
  IF NOT (OLD.accrued <=> NEW.accrued AND OLD.used <=> NEW.used AND OLD.pending <=> NEW.pending
          AND OLD.carried_forward <=> NEW.carried_forward AND OLD.encashed <=> NEW.encashed AND OLD.adjusted <=> NEW.adjusted) THEN
    INSERT INTO leave_balance_history (employee_id, leave_type_id, balance_year, old_accrued, new_accrued, old_used, new_used,
                                       old_pending, new_pending, old_carried, new_carried, old_encashed, new_encashed, changed_at, changed_by)
    VALUES (NEW.employee_id, NEW.leave_type_id, NEW.balance_year, OLD.accrued, NEW.accrued, OLD.used, NEW.used,
            OLD.pending, NEW.pending, OLD.carried_forward, NEW.carried_forward, OLD.encashed, NEW.encashed, UTC_TIMESTAMP(6), NEW.updated_by);
  END IF;
END$$

-- Balance reconciliation: recorded figures versus the application ledger (runs with the CALLER's privileges).
CREATE PROCEDURE sp_calculate_leave_balance(IN p_employee_id VARCHAR(36), IN p_year INT)
    SQL SECURITY INVOKER READS SQL DATA
BEGIN
  SELECT t.id AS leave_type_id, t.code AS leave_type_code,
         (b.opening + b.accrued + b.carried_forward + b.adjusted) AS entitled,
         b.used AS used_recorded, COALESCE(u.days, 0) AS used_from_applications,
         b.pending AS pending_recorded, COALESCE(p.days, 0) AS pending_from_applications,
         (b.opening + b.accrued + b.carried_forward + b.adjusted - b.used - b.pending - b.encashed) AS available
  FROM leave_balances b
  JOIN leave_types t ON t.id = b.leave_type_id
  LEFT JOIN (SELECT leave_type_id, SUM(days) AS days FROM leave_applications
             WHERE employee_id = p_employee_id AND status = 'APPROVED' AND YEAR(from_date) = p_year GROUP BY leave_type_id) u ON u.leave_type_id = b.leave_type_id
  LEFT JOIN (SELECT leave_type_id, SUM(days) AS days FROM leave_applications
             WHERE employee_id = p_employee_id AND status = 'PENDING' AND YEAR(from_date) = p_year GROUP BY leave_type_id) p ON p.leave_type_id = b.leave_type_id
  WHERE b.employee_id = p_employee_id AND b.balance_year = p_year
  ORDER BY t.code;
END$$

DELIMITER ;

-- Employee leave summary (no personal data: ids, leave figures only)
CREATE SQL SECURITY INVOKER VIEW vw_employee_leave_summary AS
SELECT b.employee_id, b.balance_year, t.code AS leave_type_code, t.name AS leave_type_name,
       (b.opening + b.accrued + b.carried_forward + b.adjusted) AS entitled, b.used, b.pending, b.encashed,
       (b.opening + b.accrued + b.carried_forward + b.adjusted - b.used - b.pending - b.encashed) AS available
FROM leave_balances b JOIN leave_types t ON t.id = b.leave_type_id;

-- Reference data: the eight leave types and the default policy
INSERT INTO leave_types (id, code, name, description, paid, balance_tracked, half_day_allowed, attachment_required_from_days, requires_hr_approval, gender_restriction, active, deleted, created_at, updated_at, created_by, updated_by) VALUES
 (UUID(), 'CL',   'Casual Leave',       'Short personal leave',                  1, 1, 1, NULL, 0, NULL,     1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'SL',   'Sick Leave',         'Illness; medical proof from 3 days',     1, 1, 1, 3,    0, NULL,     1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'EL',   'Earned Leave',       'Accrued annual leave',                   1, 1, 1, NULL, 0, NULL,     1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'PL',   'Privilege Leave',    'Long planned leave',                     1, 1, 1, NULL, 0, NULL,     1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'ML',   'Maternity Leave',    'Maternity (female employees)',           1, 1, 0, NULL, 1, 'FEMALE', 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'PTL',  'Paternity Leave',    'Paternity (male employees)',             1, 1, 0, NULL, 1, 'MALE',   1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'UL',   'Unpaid Leave',       'Loss of pay; no balance',                0, 0, 1, NULL, 0, NULL,     1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'COMP', 'Compensatory Leave', 'Granted for extra working days (HR adjusts the balance)', 1, 1, 1, NULL, 0, NULL, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');

SET @policy_id = UUID();
INSERT INTO leave_policies (id, name, description, is_default, active, hr_approval_threshold_days, deleted, created_at, updated_at, created_by, updated_by)
VALUES (@policy_id, 'Standard Policy', 'Default entitlement for all employees', 1, 1, 5, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');

INSERT INTO leave_policy_entitlements (policy_id, leave_type_id, annual_days, accrual_per_month, carry_forward_max, encashable, encashment_max_days, created_at, updated_at)
SELECT @policy_id, t.id, x.annual_days, x.accrual, x.carry, x.encash, x.encash_max, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
FROM leave_types t JOIN (
  SELECT 'CL' code, 12.0 annual_days, 1.00 accrual, 0.0 carry, 0 encash, 0.0 encash_max UNION ALL
  SELECT 'SL', 12.0, 1.00, 0.0, 0, 0.0 UNION ALL
  SELECT 'EL', 18.0, 1.50, 15.0, 1, 15.0 UNION ALL
  SELECT 'PL', 15.0, 1.25, 10.0, 1, 10.0 UNION ALL
  SELECT 'ML', 182.0, 0.00, 0.0, 0, 0.0 UNION ALL
  SELECT 'PTL', 10.0, 0.00, 0.0, 0, 0.0
) x ON x.code = t.code;
