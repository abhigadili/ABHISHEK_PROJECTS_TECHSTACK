ALTER TABLE employee_salaries ADD CONSTRAINT chk_salary_ctc CHECK (annual_ctc > 0);
ALTER TABLE payroll_entries ADD CONSTRAINT chk_entry_amounts CHECK (gross >= 0 AND deductions >= 0 AND net >= 0);
ALTER TABLE payroll_entry_lines ADD CONSTRAINT chk_line_amount CHECK (amount >= 0);
ALTER TABLE loans ADD CONSTRAINT chk_loan_amounts CHECK (emi > 0 AND principal > 0 AND outstanding >= 0);
ALTER TABLE payroll_entries ADD CONSTRAINT fk_entry_run FOREIGN KEY (run_id) REFERENCES payroll_runs (id);
ALTER TABLE payroll_entry_lines ADD CONSTRAINT fk_line_entry FOREIGN KEY (entry_id) REFERENCES payroll_entries (id);
ALTER TABLE payslips ADD CONSTRAINT fk_payslip_entry FOREIGN KEY (entry_id) REFERENCES payroll_entries (id);
ALTER TABLE salary_structure_components ADD CONSTRAINT fk_ssc_structure FOREIGN KEY (structure_id) REFERENCES salary_structures (id);
ALTER TABLE salary_structure_components ADD CONSTRAINT fk_ssc_component FOREIGN KEY (component_id) REFERENCES salary_components (id);
ALTER TABLE employee_salaries ADD CONSTRAINT fk_salary_structure FOREIGN KEY (structure_id) REFERENCES salary_structures (id);
ALTER TABLE loan_deductions ADD CONSTRAINT fk_loan_ded_loan FOREIGN KEY (loan_id) REFERENCES loans (id);
ALTER TABLE loan_deductions ADD CONSTRAINT fk_loan_ded_run FOREIGN KEY (run_id) REFERENCES payroll_runs (id);

DELIMITER $$

-- Salary component calculation: a fixed amount wins, otherwise a percentage of the base.
CREATE FUNCTION fn_salary_component(p_base DECIMAL(14,2), p_percent DECIMAL(9,3), p_fixed DECIMAL(14,2)) RETURNS DECIMAL(14,2)
    DETERMINISTIC NO SQL
BEGIN
  RETURN COALESCE(p_fixed, ROUND(p_base * p_percent / 100, 2));
END$$

-- Overtime pay = hours x hourly rate x multiplier (the single place where the formula lives).
CREATE FUNCTION fn_overtime_pay(p_minutes INT, p_hourly_rate DECIMAL(14,4), p_multiplier DECIMAL(5,2)) RETURNS DECIMAL(14,2)
    DETERMINISTIC NO SQL
BEGIN
  RETURN ROUND((p_minutes / 60) * p_hourly_rate * p_multiplier, 2);
END$$

-- Salary revision history: every new salary row and every CTC / status change is recorded by the database itself.
CREATE TRIGGER trg_salary_history_insert AFTER INSERT ON employee_salaries FOR EACH ROW
BEGIN
  INSERT INTO salary_revision_history (employee_id, salary_id, action, old_ctc, new_ctc, old_status, new_status, effective_from, changed_at, changed_by)
  VALUES (NEW.employee_id, NEW.id, 'CREATED', NULL, NEW.annual_ctc, NULL, NEW.status, NEW.effective_from, UTC_TIMESTAMP(6), NEW.created_by);
END$$

CREATE TRIGGER trg_salary_history_update AFTER UPDATE ON employee_salaries FOR EACH ROW
BEGIN
  IF NOT (OLD.annual_ctc <=> NEW.annual_ctc AND OLD.status <=> NEW.status) THEN
    INSERT INTO salary_revision_history (employee_id, salary_id, action, old_ctc, new_ctc, old_status, new_status, effective_from, changed_at, changed_by)
    VALUES (NEW.employee_id, NEW.id, 'UPDATED', OLD.annual_ctc, NEW.annual_ctc, OLD.status, NEW.status, NEW.effective_from, UTC_TIMESTAMP(6), NEW.updated_by);
  END IF;
END$$

-- Monthly payroll processing: runs inside the caller's transaction (no COMMIT here). The application has stored the entries, lines and
-- loan deductions; the procedure re-aggregates every total from the lines, applies loan recoveries and adjustments and marks the run PROCESSED.
CREATE PROCEDURE sp_process_monthly_payroll(IN p_run_id VARCHAR(36), IN p_user VARCHAR(100))
    SQL SECURITY INVOKER MODIFIES SQL DATA
BEGIN
  DECLARE v_month VARCHAR(7);
  DECLARE v_status VARCHAR(10);

  SELECT payroll_month, status INTO v_month, v_status FROM payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payroll run not found'; END IF;
  IF v_status <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payroll run is not in DRAFT status'; END IF;

  -- 1) entry totals from the lines
  UPDATE payroll_entries e
  JOIN (SELECT entry_id,
               SUM(CASE WHEN type = 'EARNING' THEN amount ELSE 0 END) AS earned,
               SUM(CASE WHEN type = 'DEDUCTION' THEN amount ELSE 0 END) AS deducted
        FROM payroll_entry_lines GROUP BY entry_id) t ON t.entry_id = e.id
  SET e.gross = t.earned, e.deductions = t.deducted, e.net = t.earned - t.deducted, e.updated_at = UTC_TIMESTAMP(6), e.updated_by = p_user
  WHERE e.run_id = p_run_id;

  -- 2) loan recoveries reduce the outstanding balance; a loan at zero is closed
  UPDATE loans l
  JOIN (SELECT loan_id, SUM(amount) AS recovered FROM loan_deductions WHERE run_id = p_run_id GROUP BY loan_id) d ON d.loan_id = l.id
  SET l.outstanding = GREATEST(l.outstanding - d.recovered, 0),
      l.status = IF(l.outstanding <= 0, 'CLOSED', l.status),
      l.version = l.version + 1, l.updated_at = UTC_TIMESTAMP(6), l.updated_by = p_user;

  -- 3) the month's pending adjustments of the employees in this run are now applied
  UPDATE payroll_adjustments a
  SET a.status = 'APPLIED', a.applied_run_id = p_run_id, a.updated_at = UTC_TIMESTAMP(6), a.updated_by = p_user
  WHERE a.payroll_month = v_month AND a.status = 'PENDING' AND a.employee_id IN (SELECT employee_id FROM payroll_entries WHERE run_id = p_run_id);

  -- 4) run totals and status
  UPDATE payroll_runs r
  JOIN (SELECT COUNT(*) AS cnt, COALESCE(SUM(gross), 0) AS g, COALESCE(SUM(deductions), 0) AS d, COALESCE(SUM(net), 0) AS n FROM payroll_entries WHERE run_id = p_run_id) t
  SET r.status = 'PROCESSED', r.employee_count = t.cnt, r.total_gross = t.g, r.total_deductions = t.d, r.total_net = t.n,
      r.processed_at = UTC_TIMESTAMP(6), r.processed_by = p_user, r.version = r.version + 1, r.updated_at = UTC_TIMESTAMP(6), r.updated_by = p_user
  WHERE r.id = p_run_id;
END$$

DELIMITER ;

-- Employee salary summary for payroll reporting: ids and amounts only (no names, no bank / tax data). Read only through payroll-restricted APIs.
CREATE SQL SECURITY INVOKER VIEW vw_employee_salary_summary AS
SELECT s.employee_id, st.name AS structure_name, s.annual_ctc, ROUND(s.annual_ctc / 12, 2) AS monthly_ctc,
       fn_salary_component(ROUND(s.annual_ctc / 12, 2), ssc.value, NULL) AS monthly_basic, s.currency, s.effective_from
FROM employee_salaries s
JOIN salary_structures st ON st.id = s.structure_id
LEFT JOIN salary_components c ON c.code = 'BASIC' AND c.calc_type = 'PERCENT_OF_CTC'
LEFT JOIN salary_structure_components ssc ON ssc.structure_id = s.structure_id AND ssc.component_id = c.id
WHERE s.status = 'ACTIVE';

-- ---------------------------------------------------------------------------------------------------------
-- Reference data. The statutory values below are SAMPLES for local development - verify them against current
-- regulations before any real payroll run (they are plain configuration rows, editable through the API).
-- ---------------------------------------------------------------------------------------------------------
INSERT INTO salary_components (id, code, name, type, calc_type, taxable, display_order, active, deleted, created_at, updated_at, created_by, updated_by) VALUES
 (UUID(), 'BASIC',             'Basic Salary',          'EARNING',   'PERCENT_OF_CTC',   1, 10,  1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'HRA',               'House Rent Allowance',  'EARNING',   'PERCENT_OF_BASIC', 1, 20,  1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'CONVEYANCE',        'Conveyance Allowance',  'EARNING',   'FIXED',            1, 30,  1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'MEDICAL',           'Medical Allowance',     'EARNING',   'FIXED',            1, 40,  1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'SPECIAL_ALLOWANCE', 'Special Allowance',     'EARNING',   'BALANCE',          1, 90,  1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'BONUS',             'Bonus',                 'EARNING',   'VARIABLE',         1, 100, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'OVERTIME',          'Overtime',              'EARNING',   'VARIABLE',         1, 110, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'PF',                'Provident Fund',        'DEDUCTION', 'STATUTORY_PF',     0, 200, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'PROFESSIONAL_TAX',  'Professional Tax',      'DEDUCTION', 'SLAB_PT',          0, 210, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'TDS',               'Tax Deducted at Source','DEDUCTION', 'TAX_TDS',          0, 220, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'OTHER_DEDUCTION',   'Other Deductions',      'DEDUCTION', 'VARIABLE',         0, 230, 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');

SET @std = UUID();
INSERT INTO salary_structures (id, name, description, active, deleted, created_at, updated_at, created_by, updated_by)
VALUES (@std, 'Standard Structure', 'Basic 40% of CTC, HRA 50% of basic, fixed allowances, balance in special allowance', 1, 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');

INSERT INTO salary_structure_components (id, structure_id, component_id, value, created_at, updated_at, created_by, updated_by)
SELECT UUID(), @std, c.id, x.val, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'
FROM salary_components c JOIN (
  SELECT 'BASIC' code, 40.000 val UNION ALL SELECT 'HRA', 50.000 UNION ALL SELECT 'CONVEYANCE', 1600.000 UNION ALL SELECT 'MEDICAL', 1250.000
  UNION ALL SELECT 'SPECIAL_ALLOWANCE', 0.000 UNION ALL SELECT 'PF', 0.000 UNION ALL SELECT 'PROFESSIONAL_TAX', 0.000 UNION ALL SELECT 'TDS', 0.000
) x ON x.code = c.code;

INSERT INTO payroll_config (id, config_key, config_value, description, effective_from, created_at, updated_at, created_by, updated_by) VALUES
 (UUID(), 'statutory.pf.enabled',          'true',   'SAMPLE - provident fund deduction on/off', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'statutory.pf.employee_percent', '12',     'SAMPLE - employee PF percentage (verify before production)', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'statutory.pf.wage_ceiling',     '15000',  'SAMPLE - monthly PF wage ceiling (verify before production)', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'statutory.pt.slabs',            '[{"upTo":15000,"amount":0},{"upTo":25000,"amount":150},{"upTo":null,"amount":200}]', 'SAMPLE - professional tax slabs by monthly gross (verify before production)', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'overtime.multiplier',           '2',      'Overtime pay multiplier over the hourly basic rate', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'),
 (UUID(), 'payroll.standard_hours_per_day','8',      'Hours per working day used for the hourly rate', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway');
