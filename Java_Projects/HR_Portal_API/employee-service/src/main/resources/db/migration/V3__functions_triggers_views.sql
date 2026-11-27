-- Data-quality constraints
ALTER TABLE employees ADD CONSTRAINT chk_employee_notice_period CHECK (notice_period_days BETWEEN 0 AND 365);
ALTER TABLE employees ADD CONSTRAINT chk_employee_confirmation CHECK (confirmation_date IS NULL OR confirmation_date >= joining_date);
ALTER TABLE employee_education ADD CONSTRAINT chk_education_years CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year);
ALTER TABLE employee_experience ADD CONSTRAINT chk_experience_dates CHECK (end_date IS NULL OR end_date >= start_date);

-- Counter row for employee codes (EMP00001 ...)
INSERT INTO employee_sequence (id, next_value) VALUES (1, 1);

DELIMITER $$

-- Employee tenure in whole months (reusable: reports, exit settlement, anniversaries)
CREATE FUNCTION fn_employee_tenure_months(p_joining DATE, p_as_of DATE) RETURNS INT
    DETERMINISTIC NO SQL
BEGIN
  RETURN TIMESTAMPDIFF(MONTH, p_joining, COALESCE(p_as_of, CURDATE()));
END$$

-- Employee status history trigger: every status change is recorded by the database itself, whichever code changed it.
CREATE TRIGGER trg_employee_status_history AFTER UPDATE ON employees FOR EACH ROW
BEGIN
  IF NOT (OLD.status <=> NEW.status) THEN
    INSERT INTO employee_status_history (employee_id, old_status, new_status, changed_at, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NOW(6), NEW.updated_by);
  END IF;
END$$

DELIMITER ;

-- Company directory view: ONLY non-sensitive columns (no date of birth, PAN, national id, phone, bank, personal e-mail).
CREATE SQL SECURITY INVOKER VIEW vw_employee_directory AS
SELECT e.id AS employee_id, e.employee_code, CONCAT(e.first_name, ' ', e.last_name) AS full_name, e.work_email,
       e.department_id, e.designation_id, e.location_id, e.manager_id, e.status, e.employment_type,
       e.joining_date, fn_employee_tenure_months(e.joining_date, CURDATE()) AS tenure_months
FROM employees e
WHERE e.deleted = 0 AND e.status IN ('ACTIVE', 'ON_NOTICE');
