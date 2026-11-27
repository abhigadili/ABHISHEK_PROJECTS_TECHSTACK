-- The application stores every timestamp in UTC; the trigger must too (NOW() uses the MySQL session time zone).
DROP TRIGGER IF EXISTS trg_employee_status_history;
DELIMITER $$
CREATE TRIGGER trg_employee_status_history AFTER UPDATE ON employees FOR EACH ROW
BEGIN
  IF NOT (OLD.status <=> NEW.status) THEN
    INSERT INTO employee_status_history (employee_id, old_status, new_status, changed_at, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, UTC_TIMESTAMP(6), NEW.updated_by);
  END IF;
END$$
DELIMITER ;
