// ============================================================
// WHAT: PostgreSQL DDL — CREATE TABLE statements
// WHY:  Unlike MongoDB (schema-less), PostgreSQL requires you to define
//       the schema upfront. These migrations create all tables.
// HOW:  Run runMigrations() once at startup or via: npm run migrate
// Interview Tip: In production use a migration tool (Flyway, Liquibase,
//               node-pg-migrate) for versioned, reversible migrations.
//               Never DROP TABLE in production migrations!
// ============================================================

import { query } from './connection';
import { logger } from '../utils/logger';

export const runMigrations = async (): Promise<void> => {
  logger.info('Running PostgreSQL migrations...');

  // Enable UUID extension (PostgreSQL needs this for gen_random_uuid())
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name  VARCHAR(50)  NOT NULL,
      last_name   VARCHAR(50)  NOT NULL,
      email       VARCHAR(255) NOT NULL UNIQUE,
      password    VARCHAR(255),
      role        VARCHAR(20)  NOT NULL DEFAULT 'Employee'
                  CHECK (role IN ('SuperAdmin','Admin','HR','Manager','Employee','Guest')),
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      provider    VARCHAR(20)  DEFAULT 'local',
      provider_id VARCHAR(255),
      avatar      VARCHAR(500),
      password_reset_token   VARCHAR(255),
      password_reset_expires TIMESTAMPTZ,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // companies table
  await query(`
    CREATE TABLE IF NOT EXISTS companies (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL UNIQUE,
      address     TEXT         NOT NULL,
      email       VARCHAR(255) NOT NULL,
      phone       VARCHAR(20)  NOT NULL,
      description TEXT,
      website     VARCHAR(500),
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // departments table
  await query(`
    CREATE TABLE IF NOT EXISTS departments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      company_id  UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE(name, company_id)
    )
  `);

  // employees table
  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_code  VARCHAR(20)  NOT NULL UNIQUE,
      first_name     VARCHAR(50)  NOT NULL,
      last_name      VARCHAR(50)  NOT NULL,
      email          VARCHAR(255) NOT NULL UNIQUE,
      department_id  UUID         NOT NULL REFERENCES departments(id),
      designation    VARCHAR(100) NOT NULL,
      manager_id     UUID         REFERENCES employees(id),
      salary         NUMERIC(12,2) NOT NULL CHECK (salary >= 0),
      is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // rooms table
  await query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_name    VARCHAR(100) NOT NULL UNIQUE,
      capacity     INTEGER      NOT NULL CHECK (capacity >= 1),
      floor        INTEGER      NOT NULL,
      building     VARCHAR(100) NOT NULL,
      is_available BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // meetings table
  await query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title      VARCHAR(255) NOT NULL,
      room_id    UUID         NOT NULL REFERENCES rooms(id),
      booked_by  UUID         NOT NULL REFERENCES users(id),
      start_time TIMESTAMPTZ  NOT NULL,
      end_time   TIMESTAMPTZ  NOT NULL,
      status     VARCHAR(20)  NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','cancelled','completed')),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // meeting_attendees join table
  await query(`
    CREATE TABLE IF NOT EXISTS meeting_attendees (
      meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      PRIMARY KEY (meeting_id, employee_id)
    )
  `);

  // refresh_tokens table
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT         NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ  NOT NULL,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // audit_logs table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID,
      action      VARCHAR(100) NOT NULL,
      resource    VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255),
      changes     JSONB,
      ip          VARCHAR(45),
      user_agent  TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for performance
  await query(`CREATE INDEX IF NOT EXISTS idx_employees_dept   ON employees(department_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_room    ON meetings(room_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_meetings_time    ON meetings(start_time, end_time)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_logs(created_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_companies_name   ON companies USING gin(to_tsvector('english', name))`);

  logger.info('Migrations completed successfully');
};
