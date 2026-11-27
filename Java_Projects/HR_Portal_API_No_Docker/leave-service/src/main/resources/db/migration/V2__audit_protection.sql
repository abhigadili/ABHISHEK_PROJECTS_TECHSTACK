-- Audit-history protection: the table is append-only. Any UPDATE or DELETE is rejected by the database itself,
-- independent of application code (and of the application user's privileges).
DELIMITER $$
CREATE TRIGGER trg_audit_history_no_update BEFORE UPDATE ON audit_history FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_history is append-only: UPDATE is not allowed';
END$$
CREATE TRIGGER trg_audit_history_no_delete BEFORE DELETE ON audit_history FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_history is append-only: DELETE is not allowed';
END$$
DELIMITER ;
