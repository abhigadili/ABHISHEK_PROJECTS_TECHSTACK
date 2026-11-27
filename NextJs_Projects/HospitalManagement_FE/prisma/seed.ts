/* Seed: roles, permissions, reference data, one demo hospital network and one account per role.
 * Run with `npm run db:seed`. Every seeded account gets the password from SEED_DEFAULT_PASSWORD (never hard-coded). */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_KEYS, ROLE_LABEL, type RoleKey } from '../src/lib/constants/rbac';

config({ path: '.env.local' }); config();
const db = new PrismaClient();
const pw = process.env.SEED_DEFAULT_PASSWORD;
if (!pw || pw.length < 10) throw new Error('Set SEED_DEFAULT_PASSWORD (>= 10 chars) in .env.local before seeding');

async function main() {
  const hash = await bcrypt.hash(pw!, 12);
  // ── roles + permissions (many-to-many)
  for (const [key, label] of Object.entries(PERMISSIONS)) await db.permission.upsert({ where: { key }, create: { key, label }, update: { label } });
  for (const key of ROLE_KEYS) {
    const role = await db.role.upsert({ where: { key }, create: { key, name: ROLE_LABEL[key] }, update: { name: ROLE_LABEL[key] } });
    const perms = await db.permission.findMany({ where: { key: { in: DEFAULT_ROLE_PERMISSIONS[key as RoleKey] } } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  const roleId = async (k: RoleKey) => (await db.role.findUniqueOrThrow({ where: { key: k } })).id;

  // ── hospitals, branch, departments
  const hosp = async (name: string, slug: string, code: string, city: string, extra: object = {}) => db.hospital.upsert({ where: { slug }, create: { name, slug, code, city, address: `1 Health Avenue, ${city}`, phone: '+91-40-5550100', email: `info@${slug}.example`, description: `${name} provides multi-speciality care in ${city}.`, facilities: ['Emergency 24x7', 'ICU', 'Diagnostic laboratory', 'Pharmacy', 'Ambulance'], operatingHours: { text: 'Mon-Sat 08:00-20:00, Emergency 24x7' }, ...extra }, update: {} });
  const h1 = await hosp('City General Hospital', 'city-general', 'CGH', 'Hyderabad');
  const h2 = await hosp('Lakeview Medical Centre', 'lakeview', 'LMC', 'Bengaluru');
  await hosp('City General - Gachibowli Branch', 'city-general-gachibowli', 'CGH-G', 'Hyderabad', { parentId: h1.id });
  const deptNames = ['Cardiology', 'General Medicine', 'Paediatrics', 'Orthopaedics'];
  const dep: Record<string, number> = {};
  for (const h of [h1, h2]) for (const n of deptNames) dep[`${h.id}:${n}`] = (await db.department.upsert({ where: { hospitalId_name: { hospitalId: h.id, name: n } }, create: { hospitalId: h.id, name: n }, update: {} })).id;

  // ── users (one per role) + doctors
  const user = async (email: string, first: string, last: string, role: RoleKey, hospitalId?: number) => {
    const u = await db.user.upsert({ where: { email }, create: { email, firstName: first, lastName: last, passwordHash: hash, roleId: await roleId(role), hospitalId, emailVerifiedAt: new Date(), phone: '+919900000000' }, update: { passwordHash: hash } });
    await db.notificationPreference.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });
    return u;
  };
  await user('superadmin@hms.local', 'Sam', 'Root', 'SUPER_ADMIN');
  await user('admin@hms.local', 'Asha', 'Menon', 'HOSPITAL_ADMIN', h1.id);
  await user('lab@hms.local', 'Leo', 'Fernandes', 'LAB_STAFF', h1.id);
  await user('pharmacist@hms.local', 'Priya', 'Nair', 'PHARMACIST', h1.id);
  await user('billing@hms.local', 'Bala', 'Krishnan', 'BILLING_STAFF', h1.id);
  await user('reception@hms.local', 'Rita', 'Shah', 'RECEPTIONIST', h1.id);

  const specs: Record<string, number> = {};
  for (const n of ['Cardiology', 'General Medicine', 'Paediatrics', 'Orthopaedics']) specs[n] = (await db.doctorSpecialization.upsert({ where: { name: n }, create: { name: n }, update: {} })).id;
  const doctors = [['doctor@hms.local', 'Ravi', 'Kumar', 'Cardiology', 'MD, DM Cardiology', 14, 800, h1], ['gp@hms.local', 'Meena', 'Iyer', 'General Medicine', 'MBBS, MD', 9, 500, h1], ['peds@hms.local', 'Arun', 'Rao', 'Paediatrics', 'MBBS, DCH', 11, 600, h2], ['ortho@hms.local', 'Kavya', 'Reddy', 'Orthopaedics', 'MS Ortho', 7, 700, h1]] as const;
  for (const [email, f, l, spec, q, exp, fee, h] of doctors) {
    const u = await user(email, f, l, 'DOCTOR');
    const d = await db.doctor.upsert({ where: { userId: u.id }, create: { userId: u.id, specializationId: specs[spec], licenseNumber: `LIC-${f.toUpperCase()}-${l.toUpperCase()}`, qualifications: q, experienceYears: exp, consultationFee: fee, bio: `${f} ${l} is a ${spec} specialist with ${exp} years of experience.` }, update: {} });
    await db.doctorHospitalAssignment.upsert({ where: { doctorId_hospitalId: { doctorId: d.id, hospitalId: h.id } }, create: { doctorId: d.id, hospitalId: h.id, departmentId: dep[`${h.id}:${spec}`] }, update: {} });
    for (const dow of [1, 2, 3, 4, 5]) await db.doctorAvailability.upsert({ where: { doctorId_hospitalId_dayOfWeek: { doctorId: d.id, hospitalId: h.id, dayOfWeek: dow } }, create: { doctorId: d.id, hospitalId: h.id, dayOfWeek: dow, startTime: '09:00', endTime: '17:00', slotMinutes: 30, breakStart: '13:00', breakEnd: '14:00' }, update: {} });
  }
  const pu = await user('patient@hms.local', 'Nisha', 'Verma', 'PATIENT');
  await db.patient.upsert({ where: { userId: pu.id }, create: { userId: pu.id, mrn: 'MRN26DEMO01', dateOfBirth: new Date('1990-04-12'), gender: 'FEMALE', bloodGroup: 'B+', city: 'Hyderabad', address: '12 Lake Road', emergencyContactName: 'Rahul Verma', emergencyContactPhone: '+919811111111', medicalHistory: 'Mild seasonal allergies.' }, update: {} });

  // ── pharmacy + laboratory reference data
  const cats: Record<string, number> = {};
  for (const n of ['Analgesics', 'Antibiotics', 'Cardiac', 'Vitamins']) cats[n] = (await db.medicineCategory.upsert({ where: { name: n }, create: { name: n }, update: {} })).id;
  const meds: [string, string, string, string, number][] = [['Paracetamol 500mg', 'Paracetamol', 'MED-PARA500', 'Analgesics', 2.5], ['Amoxicillin 500mg', 'Amoxicillin', 'MED-AMOX500', 'Antibiotics', 8], ['Atorvastatin 10mg', 'Atorvastatin', 'MED-ATOR10', 'Cardiac', 6], ['Ibuprofen 400mg', 'Ibuprofen', 'MED-IBU400', 'Analgesics', 3.5], ['Vitamin D3 60000IU', 'Cholecalciferol', 'MED-VITD3', 'Vitamins', 22], ['Aspirin 75mg', 'Aspirin', 'MED-ASP75', 'Cardiac', 1.8]];
  for (const [name, generic, sku, cat, price] of meds) {
    const m = await db.medicine.upsert({ where: { sku }, create: { name, genericName: generic, sku, categoryId: cats[cat], unitPrice: price, reorderLevel: 30 }, update: {} });
    await db.pharmacyInventory.upsert({ where: { medicineId_hospitalId_batchNumber: { medicineId: m.id, hospitalId: h1.id, batchNumber: 'B2601' } }, create: { medicineId: m.id, hospitalId: h1.id, batchNumber: 'B2601', expiryDate: new Date(Date.now() + 400 * 86400_000), quantity: 400 }, update: {} });
    await db.pharmacyInventory.upsert({ where: { medicineId_hospitalId_batchNumber: { medicineId: m.id, hospitalId: h1.id, batchNumber: 'B2509' } }, create: { medicineId: m.id, hospitalId: h1.id, batchNumber: 'B2509', expiryDate: new Date(Date.now() + 60 * 86400_000), quantity: 40 }, update: {} });
  }
  const lcats: Record<string, number> = {};
  for (const n of ['Haematology', 'Biochemistry', 'Microbiology']) lcats[n] = (await db.labTestCategory.upsert({ where: { name: n }, create: { name: n }, update: {} })).id;
  const tests: [string, string, string, number, string][] = [['CBC', 'Complete Blood Count', 'Haematology', 350, 'Blood'], ['LIPID', 'Lipid Profile', 'Biochemistry', 600, 'Blood'], ['HBA1C', 'HbA1c', 'Biochemistry', 550, 'Blood'], ['UCULT', 'Urine Culture', 'Microbiology', 450, 'Urine']];
  for (const [code, name, cat, price, sample] of tests) await db.laboratoryTest.upsert({ where: { code }, create: { code, name, categoryId: lcats[cat], price, sampleType: sample }, update: {} });
  console.log('Seed complete: 8 roles, %d permissions, 2 hospitals, 4 doctors, demo accounts @hms.local', Object.keys(PERMISSIONS).length);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
