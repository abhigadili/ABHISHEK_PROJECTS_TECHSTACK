-- A STUDENT login account belongs to its student profile: deleting the profile removes the account (and its refresh tokens via the existing cascade).
ALTER TABLE sms_users DROP FOREIGN KEY fk_sms_users_student;
ALTER TABLE sms_users ADD CONSTRAINT fk_sms_users_student FOREIGN KEY (student_id) REFERENCES sms_students (student_id) ON DELETE CASCADE;
