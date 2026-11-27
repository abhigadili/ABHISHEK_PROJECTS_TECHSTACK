ALTER TABLE resignations ADD CONSTRAINT chk_resignation_notice CHECK (notice_period_days >= 0 AND waiver_days >= 0);
ALTER TABLE resignations ADD CONSTRAINT chk_resignation_dates CHECK (requested_last_working_day > submitted_on);
ALTER TABLE exit_tasks ADD CONSTRAINT fk_task_resignation FOREIGN KEY (resignation_id) REFERENCES resignations (id);
ALTER TABLE exit_interviews ADD CONSTRAINT fk_interview_resignation FOREIGN KEY (resignation_id) REFERENCES resignations (id);
ALTER TABLE settlements ADD CONSTRAINT fk_settlement_resignation FOREIGN KEY (resignation_id) REFERENCES resignations (id);
ALTER TABLE settlement_lines ADD CONSTRAINT fk_sline_settlement FOREIGN KEY (settlement_id) REFERENCES settlements (id);
ALTER TABLE exit_history ADD CONSTRAINT fk_exit_history_resignation FOREIGN KEY (resignation_id) REFERENCES resignations (id);

DELIMITER $$

-- Employee tenure in whole months.
CREATE FUNCTION fn_employee_tenure_months(p_joining DATE, p_as_of DATE) RETURNS INT
    DETERMINISTIC NO SQL
BEGIN
  IF p_joining IS NULL THEN RETURN 0; END IF;
  RETURN TIMESTAMPDIFF(MONTH, p_joining, COALESCE(p_as_of, CURDATE()));
END$$

-- Exit settlement summary: totals are re-aggregated from the settlement lines (earnings - deductions); the result set adds tenure and the
-- notice shortfall (after waiver). Runs with the caller's privileges.
CREATE PROCEDURE sp_exit_settlement_summary(IN p_resignation_id VARCHAR(36))
    SQL SECURITY INVOKER MODIFIES SQL DATA
BEGIN
  UPDATE settlements s
  JOIN (SELECT settlement_id,
               SUM(CASE WHEN type = 'EARNING' THEN amount ELSE 0 END) AS earned,
               SUM(CASE WHEN type = 'DEDUCTION' THEN amount ELSE 0 END) AS deducted
        FROM settlement_lines GROUP BY settlement_id) t ON t.settlement_id = s.id
  SET s.gross_payable = t.earned, s.recoveries = t.deducted, s.net_payable = t.earned - t.deducted, s.updated_at = UTC_TIMESTAMP(6)
  WHERE s.resignation_id = p_resignation_id;

  SELECT s.id, s.gross_payable, s.recoveries, s.net_payable,
         fn_employee_tenure_months(r.joining_date, r.confirmed_last_working_day) AS tenure_months,
         GREATEST(r.notice_period_days - DATEDIFF(r.confirmed_last_working_day, r.submitted_on) - r.waiver_days, 0) AS notice_shortfall_days
  FROM settlements s JOIN resignations r ON r.id = s.resignation_id
  WHERE s.resignation_id = p_resignation_id;
END$$

DELIMITER ;

INSERT INTO exit_policy (id, default_notice_days, max_waiver_days, withdrawal_after_confirmation, salary_days_per_month, created_at, updated_at, created_by, updated_by)
VALUES (UUID(), 60, 30, 0, 30, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');

INSERT INTO exit_interview_forms (id, name, questions, active, created_at, updated_at, created_by, updated_by) VALUES
 (UUID(), 'Standard Exit Interview',
  '[{"id":"q1","text":"What is your main reason for leaving?","type":"TEXT","required":"true"},{"id":"q2","text":"How would you rate your overall experience (1-5)?","type":"RATING","required":"true"},{"id":"q3","text":"How would you rate your manager (1-5)?","type":"RATING","required":"false"},{"id":"q4","text":"What could the company have done better?","type":"TEXT","required":"false"}]',
  1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');
