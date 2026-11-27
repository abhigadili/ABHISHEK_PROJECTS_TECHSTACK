"use strict";
// ============================================================
// Database seeder — creates initial data for development/testing
// Run: npm run seed
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connection_1 = require("../src/database/connection");
const migrations_1 = require("../src/database/migrations");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const seed = async () => {
    await (0, connection_1.connectDB)();
    console.log('Connected to PostgreSQL');
    await (0, migrations_1.runMigrations)();
    console.log('Migrations run');
    // Clear existing data (FK-safe order: children before parents)
    await (0, connection_1.query)('DELETE FROM meeting_attendees');
    await (0, connection_1.query)('DELETE FROM meetings');
    await (0, connection_1.query)('DELETE FROM employees');
    await (0, connection_1.query)('DELETE FROM departments');
    await (0, connection_1.query)('DELETE FROM companies');
    await (0, connection_1.query)('DELETE FROM users');
    console.log('Cleared existing data');
    // Users
    const adminPwd = await bcryptjs_1.default.hash('Admin123!', 12);
    const hrPwd = await bcryptjs_1.default.hash('Hr123456!', 12);
    const adminRows = await (0, connection_1.query)(`
    INSERT INTO users (first_name, last_name, email, password, role)
    VALUES ('Super','Admin','admin@lm.com',$1,'SuperAdmin') RETURNING id, email
  `, [adminPwd]);
    await (0, connection_1.query)(`
    INSERT INTO users (first_name, last_name, email, password, role)
    VALUES ('HR','Manager','hr@lm.com',$1,'HR') RETURNING id, email
  `, [hrPwd]);
    console.log('Users seeded: admin@lm.com, hr@lm.com');
    // Company
    const compRows = await (0, connection_1.query)(`
    INSERT INTO companies (name, address, email, phone, description, website)
    VALUES ('LM Technologies','Hyderabad, India','contact@lm.com','+91-9999999999','Enterprise software solutions','https://lm.com')
    RETURNING id
  `);
    const companyId = compRows[0].id;
    // Departments
    const [engDept, hrDept] = await Promise.all([
        (0, connection_1.query)(`INSERT INTO departments (name, description, company_id) VALUES ('Engineering','Software development',$1) RETURNING id`, [companyId]),
        (0, connection_1.query)(`INSERT INTO departments (name, description, company_id) VALUES ('Human Resources','People operations',$1) RETURNING id`, [companyId]),
    ]);
    const engId = engDept[0].id;
    const hrId = hrDept[0].id;
    // Employees
    await (0, connection_1.query)(`
    INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation, salary)
    VALUES
      ('EMP001','Alice','Smith','alice@lm.com',$1,'Senior Engineer',120000),
      ('EMP002','Bob','Jones','bob@lm.com',$1,'Engineer',80000),
      ('EMP003','Carol','White','carol@lm.com',$2,'HR Specialist',70000),
      ('EMP004','Dave','Brown','dave@lm.com',$1,'Junior Engineer',50000),
      ('EMP005','Eve','Davis','eve@lm.com',$1,'Manager',150000)
  `, [engId, hrId]);
    // Rooms
    await (0, connection_1.query)(`
    INSERT INTO rooms (room_name, capacity, floor, building)
    VALUES
      ('Boardroom A',20,5,'HQ'),
      ('Meeting Room B',8,3,'HQ'),
      ('Conference C',50,10,'Annex'),
      ('Huddle D',4,2,'HQ')
  `);
    console.log('Seed data created successfully!');
    console.log('Login: admin@lm.com / Admin123!  |  hr@lm.com / Hr123456!');
    await (0, connection_1.disconnectDB)();
};
seed().catch(err => { console.error(err); process.exit(1); });
