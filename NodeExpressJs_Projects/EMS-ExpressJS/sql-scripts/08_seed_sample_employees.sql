-- 08_seed_sample_employees.sql
-- DEVELOPMENT ONLY. Fictional people, example.com addresses, no login accounts
-- (create logins through the API or `npm run admin:create`). Idempotent.
USE ems_expressjs;

INSERT INTO departments (id, code, name, description) VALUES
  (1, 'EXEC', 'Executive',   'Company leadership'),
  (2, 'HR',   'Human Resources', 'People operations'),
  (3, 'ENG',  'Engineering', 'Product engineering'),
  (4, 'SALES','Sales',       'Revenue and accounts')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO designations (id, name, description, job_level) VALUES
  (1, 'Chief Executive Officer', 'Top executive', 10),
  (2, 'Director',          'Department director', 8),
  (3, 'Manager',           'People manager', 6),
  (4, 'Senior Engineer',   'Senior individual contributor', 5),
  (5, 'Engineer',          'Individual contributor', 4),
  (6, 'Executive',         'Entry/mid-level executive', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO teams (id, department_id, name, description) VALUES
  (1, 3, 'Platform', 'Backend and infrastructure'),
  (2, 3, 'Quality',  'QA and release'),
  (3, 4, 'Enterprise Sales', 'Enterprise accounts')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO employees
 (id, employee_code, first_name, last_name, work_email, phone, date_of_birth, joining_date,
  status, employment_type, designation_id, job_title, department_id, team_id, manager_id,
  work_location, salary, salary_currency, city, country)
VALUES
 (1,  'EMP-1001','Avery','Stone',   'avery.stone@example.com',   '+1-555-0101','1975-03-14','2015-01-05','ACTIVE','FULL_TIME',1,'Chief Executive Officer',1,NULL,NULL,'HQ',300000,'USD','Austin','USA'),
 (2,  'EMP-1002','Priya','Nair',    'priya.nair@example.com',    '+1-555-0102','1982-07-22','2016-03-01','ACTIVE','FULL_TIME',2,'HR Director',2,NULL,1,'HQ',150000,'USD','Austin','USA'),
 (3,  'EMP-1003','Daniel','Brooks', 'daniel.brooks@example.com', '+1-555-0103','1979-11-02','2016-06-15','ACTIVE','FULL_TIME',2,'VP Engineering',3,NULL,1,'HQ',210000,'USD','Austin','USA'),
 (4,  'EMP-1004','Maria','Lopez',   'maria.lopez@example.com',   '+1-555-0104','1986-05-30','2018-02-12','ACTIVE','FULL_TIME',3,'Engineering Manager',3,1,3,'HQ',160000,'USD','Dallas','USA'),
 (5,  'EMP-1005','Liam','Chen',     'liam.chen@example.com',     '+1-555-0105','1990-09-09','2019-08-19','ACTIVE','FULL_TIME',4,'Senior Backend Engineer',3,1,4,'HQ',130000,'USD','Austin','USA'),
 (6,  'EMP-1006','Sofia','Rossi',   'sofia.rossi@example.com',   '+1-555-0106','1993-01-18','2021-01-11','ACTIVE','FULL_TIME',5,'Backend Engineer',3,1,4,'Remote',105000,'USD','Denver','USA'),
 (7,  'EMP-1007','Noah','Kim',      'noah.kim@example.com',      '+1-555-0107','1995-12-05','2022-04-04','ACTIVE','FULL_TIME',5,'Backend Engineer',3,1,4,'HQ',98000,'USD','Austin','USA'),
 (8,  'EMP-1008','Hannah','Weber',  'hannah.weber@example.com',  '+1-555-0108','1984-04-25','2017-09-18','ACTIVE','FULL_TIME',3,'Sales Manager',4,3,1,'HQ',140000,'USD','Chicago','USA'),
 (9,  'EMP-1009','Omar','Hassan',   'omar.hassan@example.com',   '+1-555-0109','1991-06-13','2020-02-24','ACTIVE','FULL_TIME',6,'Account Executive',4,3,8,'Remote',90000,'USD','Houston','USA'),
 (10, 'EMP-1010','Emma','Wilson',   'emma.wilson@example.com',   '+1-555-0110','1994-10-29','2022-10-03','ACTIVE','FULL_TIME',6,'Account Executive',4,3,8,'HQ',88000,'USD','Austin','USA'),
 (11, 'EMP-1011','Ravi','Patel',    'ravi.patel@example.com',    '+1-555-0111','1992-02-08','2021-05-17','ACTIVE','FULL_TIME',6,'HR Executive',2,NULL,2,'HQ',72000,'USD','Austin','USA'),
 (12, 'EMP-1012','Chloe','Martin',  'chloe.martin@example.com',  '+1-555-0112','1996-08-21','2023-01-09','ACTIVE','CONTRACT', 5,'QA Engineer',3,2,4,'HQ',85000,'USD','Austin','USA')
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);

UPDATE departments SET head_employee_id = 1 WHERE id = 1 AND head_employee_id IS NULL;
UPDATE departments SET head_employee_id = 2 WHERE id = 2 AND head_employee_id IS NULL;
UPDATE departments SET head_employee_id = 3 WHERE id = 3 AND head_employee_id IS NULL;
UPDATE departments SET head_employee_id = 8 WHERE id = 4 AND head_employee_id IS NULL;

INSERT INTO job_history (employee_id, change_type, effective_date, to_designation_id, to_department_id, to_manager_id, to_job_title, notes)
SELECT e.id, 'JOINED', e.joining_date, e.designation_id, e.department_id, e.manager_id, e.job_title, 'Seeded joining record'
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM job_history j WHERE j.employee_id = e.id AND j.change_type = 'JOINED');

INSERT INTO holidays (holiday_date, name, location) VALUES
  ('2026-01-01', 'New Year''s Day', 'ALL'),
  ('2026-05-25', 'Memorial Day', 'ALL'),
  ('2026-07-03', 'Independence Day (observed)', 'ALL'),
  ('2026-09-07', 'Labor Day', 'ALL'),
  ('2026-11-26', 'Thanksgiving', 'ALL'),
  ('2026-12-25', 'Christmas Day', 'ALL')
ON DUPLICATE KEY UPDATE name = VALUES(name);
