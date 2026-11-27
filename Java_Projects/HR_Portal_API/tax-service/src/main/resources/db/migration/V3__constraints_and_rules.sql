ALTER TABLE tax_declarations ADD CONSTRAINT chk_declaration_amounts CHECK (total_declared >= 0 AND total_approved >= 0);
ALTER TABLE investment_declarations ADD CONSTRAINT chk_investment_amounts CHECK (declared_amount > 0 AND approved_amount >= 0 AND approved_amount <= declared_amount);
ALTER TABLE tax_rules ADD CONSTRAINT chk_rule_cess CHECK (cess_percent >= 0 AND cess_percent <= 100);
ALTER TABLE investment_declarations ADD CONSTRAINT fk_investment_declaration FOREIGN KEY (declaration_id) REFERENCES tax_declarations (id);
ALTER TABLE tax_proofs ADD CONSTRAINT fk_proof_investment FOREIGN KEY (investment_id) REFERENCES investment_declarations (id);
ALTER TABLE tax_proofs ADD CONSTRAINT fk_proof_declaration FOREIGN KEY (declaration_id) REFERENCES tax_declarations (id);
ALTER TABLE tax_declaration_history ADD CONSTRAINT fk_tax_history_declaration FOREIGN KEY (declaration_id) REFERENCES tax_declarations (id);

-- ---------------------------------------------------------------------------------------------------------
-- SAMPLE tax rules for local development (financial years 2025-26 and 2026-27). They are configuration rows:
-- the figures MUST be verified against the current Finance Act before any real payroll / TDS use, and can be
-- changed through PUT /api/v1/tax/rules/{id} without a deployment.
-- ---------------------------------------------------------------------------------------------------------
INSERT INTO tax_rules (id, financial_year, regime, slabs, section_limits, standard_deduction, cess_percent, rebate_limit, rebate_amount, active, created_at, updated_at, created_by, updated_by)
SELECT UUID(), fy.v, 'NEW',
       '[{"from":0,"to":400000,"rate":0},{"from":400000,"to":800000,"rate":5},{"from":800000,"to":1200000,"rate":10},{"from":1200000,"to":1600000,"rate":15},{"from":1600000,"to":2000000,"rate":20},{"from":2000000,"to":2400000,"rate":25},{"from":2400000,"to":null,"rate":30}]',
       '{}', 75000, 4, 1200000, 60000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'
FROM (SELECT '2025-26' AS v UNION ALL SELECT '2026-27') fy;

INSERT INTO tax_rules (id, financial_year, regime, slabs, section_limits, standard_deduction, cess_percent, rebate_limit, rebate_amount, active, created_at, updated_at, created_by, updated_by)
SELECT UUID(), fy.v, 'OLD',
       '[{"from":0,"to":250000,"rate":0},{"from":250000,"to":500000,"rate":5},{"from":500000,"to":1000000,"rate":20},{"from":1000000,"to":null,"rate":30}]',
       '{"80C":150000,"80CCD1B":50000,"80D":50000,"80E":1000000,"80G":100000,"HRA":600000,"HOME_LOAN_INTEREST":200000}', 50000, 4, 500000, 12500, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6), 'flyway', 'flyway'
FROM (SELECT '2025-26' AS v UNION ALL SELECT '2026-27') fy;
