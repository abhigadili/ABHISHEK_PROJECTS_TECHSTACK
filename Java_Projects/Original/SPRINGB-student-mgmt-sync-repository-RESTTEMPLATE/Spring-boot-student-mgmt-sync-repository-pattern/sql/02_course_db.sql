-- ============================================================
-- CourseDB — owned exclusively by course-service.
-- ============================================================
DROP DATABASE IF EXISTS CourseDB;
CREATE DATABASE CourseDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE CourseDB;

CREATE TABLE Course_Category (
    category_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_name   VARCHAR(100) NOT NULL UNIQUE,
    description     VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE Courses (
    course_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id     BIGINT NOT NULL,
    course_code     VARCHAR(20)  NOT NULL UNIQUE,
    course_name     VARCHAR(150) NOT NULL,
    description     TEXT,
    duration_weeks  INT,
    credits         INT,
    fee             DECIMAL(10,2),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_course_category FOREIGN KEY (category_id) REFERENCES Course_Category(category_id)
) ENGINE=InnoDB;

CREATE TABLE Course_Schedule (
    schedule_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id       BIGINT NOT NULL,
    start_date      DATE,
    end_date        DATE,
    class_days      VARCHAR(50),
    start_time      TIME,
    end_time        TIME,
    room_number     VARCHAR(20),
    CONSTRAINT fk_schedule_course FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Course_Faculty (
    faculty_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id       BIGINT NOT NULL,
    faculty_name    VARCHAR(100) NOT NULL,
    email           VARCHAR(100),
    designation     VARCHAR(50),
    department      VARCHAR(50),
    CONSTRAINT fk_faculty_course FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- sample data ----
INSERT INTO Course_Category (category_name, description) VALUES
('Computer Science', 'Programming, systems and software engineering courses'),
('Data Science',      'Statistics, machine learning and analytics courses'),
('Business',          'Management and finance courses'),
('Design',            'UI/UX and visual design courses');

INSERT INTO Courses (category_id, course_code, course_name, description, duration_weeks, credits, fee) VALUES
(1, 'CS101', 'Introduction to Java',        'Core Java programming fundamentals',        8,  4, 15000.00),
(1, 'CS201', 'Spring Boot Microservices',   'Building microservices with Spring Boot',   10, 4, 22000.00),
(2, 'DS101', 'Python for Data Analysis',    'Pandas, NumPy and data wrangling',           8,  3, 18000.00),
(2, 'DS201', 'Machine Learning Basics',     'Supervised and unsupervised learning',      12, 4, 25000.00),
(3, 'BU101', 'Financial Accounting',        'Fundamentals of accounting principles',      6,  3, 12000.00),
(4, 'DZ101', 'UI/UX Design Fundamentals',   'Design thinking and prototyping',            6,  3, 14000.00);

INSERT INTO Course_Schedule (course_id, start_date, end_date, class_days, start_time, end_time, room_number) VALUES
(1, '2025-08-01', '2025-09-26', 'Mon,Wed,Fri', '09:00:00', '11:00:00', 'A-101'),
(2, '2025-08-05', '2025-10-14', 'Tue,Thu',     '14:00:00', '16:30:00', 'A-102'),
(3, '2025-08-01', '2025-09-26', 'Mon,Wed',     '11:00:00', '13:00:00', 'B-201'),
(4, '2025-09-01', '2025-11-21', 'Tue,Thu,Sat', '09:00:00', '11:30:00', 'B-202'),
(5, '2025-08-10', '2025-09-21', 'Wed,Fri',     '15:00:00', '17:00:00', 'C-301'),
(6, '2025-08-15', '2025-09-26', 'Mon,Thu',     '10:00:00', '12:00:00', 'D-101');

INSERT INTO Course_Faculty (course_id, faculty_name, email, designation, department) VALUES
(1, 'Dr. Neha Verma',    'neha.verma@faculty.edu',    'Assistant Professor', 'Computer Science'),
(2, 'Prof. Arjun Mehta', 'arjun.mehta@faculty.edu',   'Associate Professor', 'Computer Science'),
(3, 'Dr. Priya Nair',    'priya.nair@faculty.edu',    'Assistant Professor', 'Data Science'),
(4, 'Prof. Rohan Gupta', 'rohan.gupta@faculty.edu',   'Professor',           'Data Science'),
(5, 'Dr. Kavita Joshi',  'kavita.joshi@faculty.edu',  'Assistant Professor', 'Business'),
(6, 'Prof. Sara Khan',   'sara.khan@faculty.edu',     'Lecturer',            'Design');
