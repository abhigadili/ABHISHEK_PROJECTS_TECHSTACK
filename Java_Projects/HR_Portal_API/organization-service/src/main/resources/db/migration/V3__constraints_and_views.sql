-- Foreign keys INSIDE this service's database only (no cross-database keys: other services are referenced by id).
ALTER TABLE business_units ADD CONSTRAINT fk_bu_organization FOREIGN KEY (organization_id) REFERENCES organizations (id);
ALTER TABLE departments ADD CONSTRAINT fk_dept_business_unit FOREIGN KEY (business_unit_id) REFERENCES business_units (id);
ALTER TABLE departments ADD CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES departments (id);
ALTER TABLE designations ADD CONSTRAINT fk_designation_grade FOREIGN KEY (job_grade_id) REFERENCES job_grades (id);
ALTER TABLE job_grades ADD CONSTRAINT chk_grade_salary_range CHECK (min_salary IS NULL OR max_salary IS NULL OR min_salary <= max_salary);
ALTER TABLE job_grades ADD CONSTRAINT chk_grade_level CHECK (grade_level >= 1);
ALTER TABLE reporting_lines ADD CONSTRAINT chk_line_period CHECK (effective_to IS NULL OR effective_to >= effective_from);

-- Employee + department details (no personal or salary data: id, code, name, status, org placement only).
CREATE SQL SECURITY INVOKER VIEW vw_employee_department_details AS
SELECT n.employee_id, n.employee_code, n.full_name, n.status, n.joining_date,
       d.name AS department_name, d.code AS department_code,
       ds.title AS designation_title, g.name AS job_grade_name,
       l.name AS location_name, n.manager_id
FROM org_employee_nodes n
LEFT JOIN departments d ON d.id = n.department_id AND d.deleted = 0
LEFT JOIN designations ds ON ds.id = n.designation_id AND ds.deleted = 0
LEFT JOIN job_grades g ON g.id = ds.job_grade_id AND g.deleted = 0
LEFT JOIN locations l ON l.id = n.location_id AND l.deleted = 0;
