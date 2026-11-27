-- Runs automatically the first time the `mysql` container starts (mounted into
-- /docker-entrypoint-initdb.d/ by docker-compose.yml). Creates one empty
-- database per microservice, enforcing Database-per-Service at the
-- infrastructure level: each service's own EF Core migrations (run
-- automatically by db.Database.Migrate() in each service's Program.cs) then
-- create that service's own tables inside its own database only.

CREATE DATABASE IF NOT EXISTS StudentDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS CourseDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS EnrollmentDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS NotificationDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
