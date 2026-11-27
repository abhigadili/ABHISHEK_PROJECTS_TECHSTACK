// ============================================================
// Database seeder — creates initial data for development/testing
// Run: npm run seed
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { config } from '../src/config/env.config';
import { User } from '../src/models/user.model';
import { Company } from '../src/models/company.model';
import { Department } from '../src/models/department.model';
import { Employee } from '../src/models/employee.model';
import { Room } from '../src/models/room.model';

const seed = async () => {
  await mongoose.connect(config.mongo.uri);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}), Company.deleteMany({}),
    Department.deleteMany({}), Employee.deleteMany({}), Room.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // Users
  const admin = await User.create({
    firstName: 'Super', lastName: 'Admin',
    email: 'admin@lm.com', password: 'Admin123!', role: 'SuperAdmin',
  });
  const hrUser = await User.create({
    firstName: 'HR', lastName: 'Manager',
    email: 'hr@lm.com', password: 'Hr123456!', role: 'HR',
  });
  console.log('Users created:', admin.email, hrUser.email);

  // Company
  const company = await Company.create({
    name: 'LM Technologies', address: 'Hyderabad, India',
    email: 'contact@lm.com', phone: '+91-9999999999',
    description: 'Enterprise software solutions', website: 'https://lm.com',
  });

  // Departments
  const [engDept, hrDept] = await Department.create([
    { name: 'Engineering', description: 'Software development', companyId: company._id },
    { name: 'Human Resources', description: 'People operations', companyId: company._id },
  ]);

  // Employees
  await Employee.create([
    { employeeCode: 'EMP001', firstName: 'Alice', lastName: 'Smith', email: 'alice@lm.com', departmentId: engDept._id, designation: 'Senior Engineer', salary: 120000 },
    { employeeCode: 'EMP002', firstName: 'Bob',   lastName: 'Jones', email: 'bob@lm.com',   departmentId: engDept._id, designation: 'Engineer',        salary: 80000 },
    { employeeCode: 'EMP003', firstName: 'Carol', lastName: 'White', email: 'carol@lm.com', departmentId: hrDept._id,  designation: 'HR Specialist',    salary: 70000 },
    { employeeCode: 'EMP004', firstName: 'Dave',  lastName: 'Brown', email: 'dave@lm.com',  departmentId: engDept._id, designation: 'Junior Engineer',  salary: 50000 },
    { employeeCode: 'EMP005', firstName: 'Eve',   lastName: 'Davis', email: 'eve@lm.com',   departmentId: engDept._id, designation: 'Manager',          salary: 150000 },
  ]);

  // Rooms
  await Room.create([
    { roomName: 'Boardroom A', capacity: 20, floor: 5, building: 'HQ', isAvailable: true },
    { roomName: 'Meeting Room B', capacity: 8, floor: 3, building: 'HQ', isAvailable: true },
    { roomName: 'Conference C', capacity: 50, floor: 10, building: 'Annex', isAvailable: true },
    { roomName: 'Huddle D', capacity: 4, floor: 2, building: 'HQ', isAvailable: true },
  ]);

  console.log('Seed data created successfully!');
  console.log('Login credentials:');
  console.log('  SuperAdmin: admin@lm.com / Admin123!');
  console.log('  HR:         hr@lm.com / Hr123456!');

  await mongoose.disconnect();
};

seed().catch(err => { console.error(err); process.exit(1); });
