-- Simulates the pre-existing StudentDB content that must survive our Flyway migration untouched.
CREATE TABLE Students (
  student_id BIGINT NOT NULL AUTO_INCREMENT, first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL, PRIMARY KEY (student_id), UNIQUE KEY email (email)
) ENGINE=InnoDB;
INSERT INTO Students (first_name, last_name, email) VALUES ('Legacy', 'Student', 'legacy@example.com');
