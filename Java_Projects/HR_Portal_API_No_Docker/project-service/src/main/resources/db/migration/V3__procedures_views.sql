ALTER TABLE projects ADD CONSTRAINT chk_project_dates CHECK (end_date IS NULL OR end_date >= start_date);
ALTER TABLE project_allocations ADD CONSTRAINT chk_alloc_percent CHECK (allocation_percent > 0 AND allocation_percent <= 100);
ALTER TABLE project_allocations ADD CONSTRAINT chk_alloc_dates CHECK (end_date IS NULL OR end_date >= start_date);
ALTER TABLE projects ADD CONSTRAINT fk_project_customer FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE project_allocations ADD CONSTRAINT fk_alloc_project FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE customer_contacts ADD CONSTRAINT fk_contact_customer FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE project_history ADD CONSTRAINT fk_history_project FOREIGN KEY (project_id) REFERENCES projects (id);

DELIMITER $$

-- Allocation of one employee on a date: every live allocation with its project (caller's privileges apply).
CREATE PROCEDURE sp_employee_allocation_summary(IN p_employee_id VARCHAR(36), IN p_on_date DATE)
    SQL SECURITY INVOKER READS SQL DATA
BEGIN
  SELECT p.id AS project_id, p.code AS project_code, p.name AS project_name, a.role, a.allocation_percent, a.billable
  FROM project_allocations a JOIN projects p ON p.id = a.project_id AND p.deleted = 0
  WHERE a.employee_id = p_employee_id AND a.status = 'ACTIVE'
    AND a.start_date <= p_on_date AND (a.end_date IS NULL OR a.end_date >= p_on_date)
  ORDER BY p.name;
END$$

DELIMITER ;

-- Project / employee allocation (no personal data beyond the employee id and display name)
CREATE SQL SECURITY INVOKER VIEW vw_project_employee_allocation AS
SELECT a.id AS allocation_id, p.id AS project_id, p.code AS project_code, p.name AS project_name, p.status AS project_status,
       c.name AS customer_name, a.employee_id, a.employee_name, a.role, a.allocation_percent, a.billable,
       a.start_date, a.end_date, a.status AS allocation_status
FROM project_allocations a
JOIN projects p ON p.id = a.project_id AND p.deleted = 0
JOIN customers c ON c.id = p.customer_id AND c.deleted = 0;
