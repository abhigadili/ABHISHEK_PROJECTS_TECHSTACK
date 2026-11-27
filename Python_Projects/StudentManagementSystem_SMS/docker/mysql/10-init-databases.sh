#!/bin/bash
# Runs once, on first start of an empty MySQL data volume (official image convention).
# Creates one database per microservice and grants the application user access to them only.
set -euo pipefail
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS StudentManagementAuthDB         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS StudentManagementStudentDB      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS StudentManagementCourseDB       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS StudentManagementEnrollmentDB   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS StudentManagementNotificationDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`StudentManagement%\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
