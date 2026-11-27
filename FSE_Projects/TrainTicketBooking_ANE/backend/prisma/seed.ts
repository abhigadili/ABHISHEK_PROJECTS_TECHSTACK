/* Seed data: roles/permissions, coach & seat types, cancellation rules, stations, 6 trains with routes/schedules/coaches/seats and demo accounts.
 * Idempotent: safe to run again. Demo account password = SEED_DEFAULT_PASSWORD (never hard-coded). */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { PERMISSIONS, ROLE_KEYS, ROLE_LABEL, ROLE_PERMISSIONS } from '../src/constants/rbac';
import { SEAT_TYPES, seatTypeFor } from '../src/utils/seatLayout';

const db = new PrismaClient();
const pw = process.env.SEED_DEFAULT_PASSWORD;
if (!pw || pw.length < 8) throw new Error('Set SEED_DEFAULT_PASSWORD (>= 8 chars) in backend/.env before seeding');

const stations: [string, string, string, string][] = [
  ['NDLS', 'New Delhi', 'New Delhi', 'Delhi'], ['SC', 'Secunderabad Junction', 'Hyderabad', 'Telangana'], ['WL', 'Warangal', 'Warangal', 'Telangana'], ['NGP', 'Nagpur Junction', 'Nagpur', 'Maharashtra'],
  ['BPL', 'Bhopal Junction', 'Bhopal', 'Madhya Pradesh'], ['JHS', 'Jhansi Junction', 'Jhansi', 'Uttar Pradesh'], ['AGC', 'Agra Cantt', 'Agra', 'Uttar Pradesh'], ['MAS', 'Chennai Central', 'Chennai', 'Tamil Nadu'],
  ['KPD', 'Katpadi Junction', 'Vellore', 'Tamil Nadu'], ['SBC', 'KSR Bengaluru City', 'Bengaluru', 'Karnataka'], ['CSMT', 'Mumbai CSMT', 'Mumbai', 'Maharashtra'], ['KYN', 'Kalyan Junction', 'Kalyan', 'Maharashtra'],
  ['PUNE', 'Pune Junction', 'Pune', 'Maharashtra'], ['BZA', 'Vijayawada Junction', 'Vijayawada', 'Andhra Pradesh'], ['VSKP', 'Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh'],
];
const coachTypes: [string, string, number, number, string][] = [['SL', 'Sleeper', 0.6, 72, 'BERTH6'], ['3A', 'AC 3 Tier', 1.6, 64, 'BERTH6'], ['2A', 'AC 2 Tier', 2.3, 48, 'BERTH4'], ['1A', 'AC First Class', 3.8, 24, 'BERTH2'], ['CC', 'Chair Car', 1.4, 78, 'SEAT'], ['2S', 'Second Sitting', 0.45, 108, 'SEAT']];
type Stop = [string, string | null, string | null, number, number]; // station, arrival, departure, dayOffset, km
const trains: { number: string; name: string; type: 'EXPRESS' | 'SUPERFAST' | 'PREMIUM'; days: number[]; coaches: [string, number][]; stops: Stop[] }[] = [
  { number: '12723', name: 'Telangana Express', type: 'SUPERFAST', days: [0, 1, 2, 3, 4, 5, 6], coaches: [['SL', 3], ['3A', 2], ['2A', 1]], stops: [['SC', null, '06:25', 0, 0], ['WL', '08:10', '08:12', 0, 157], ['NGP', '12:30', '12:40', 0, 581], ['BPL', '17:00', '17:05', 0, 878], ['JHS', '19:50', '19:55', 0, 1085], ['AGC', '23:20', '23:22', 0, 1300], ['NDLS', '02:15', null, 1, 1660]] },
  { number: '12007', name: 'Chennai Shatabdi', type: 'PREMIUM', days: [0, 1, 2, 4, 5, 6], coaches: [['CC', 2]], stops: [['MAS', null, '06:00', 0, 0], ['KPD', '07:30', '07:32', 0, 125], ['SBC', '11:00', null, 0, 362]] },
  { number: '12859', name: 'Mumbai Pune Express', type: 'EXPRESS', days: [0, 1, 2, 3, 4, 5, 6], coaches: [['CC', 2], ['2S', 2]], stops: [['CSMT', null, '05:30', 0, 0], ['KYN', '06:15', '06:17', 0, 54], ['PUNE', '09:00', null, 0, 192]] },
  { number: '22691', name: 'Bengaluru Rajdhani', type: 'SUPERFAST', days: [2, 5, 0], coaches: [['1A', 1], ['2A', 2], ['3A', 3]], stops: [['SBC', null, '20:00', 0, 0], ['SC', '06:30', '06:45', 1, 574], ['NGP', '13:00', '13:10', 1, 1155], ['BPL', '17:20', '17:25', 1, 1450], ['NDLS', '05:30', null, 2, 2430]] },
  { number: '12739', name: 'Visakha Express', type: 'EXPRESS', days: [0, 1, 2, 3, 4, 5, 6], coaches: [['SL', 3], ['3A', 2], ['2A', 1]], stops: [['SC', null, '17:00', 0, 0], ['BZA', '21:30', '21:35', 0, 350], ['VSKP', '05:30', null, 1, 700]] },
  { number: '12760', name: 'Charminar Express', type: 'EXPRESS', days: [0, 1, 2, 3, 4, 5, 6], coaches: [['SL', 2], ['3A', 2], ['2S', 1]], stops: [['SC', null, '18:00', 0, 0], ['BZA', '23:10', '23:15', 0, 350], ['MAS', '08:30', null, 1, 790]] },
];

async function main() {
  const hash = await bcrypt.hash(pw!, 12);
  for (const [key, label] of Object.entries(PERMISSIONS)) await db.permission.upsert({ where: { key }, create: { key, label }, update: { label } });
  for (const key of ROLE_KEYS) {
    const role = await db.role.upsert({ where: { key }, create: { key, name: ROLE_LABEL[key] }, update: { name: ROLE_LABEL[key] } });
    const perms = await db.permission.findMany({ where: { key: { in: ROLE_PERMISSIONS[key] } } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  for (const [code, name] of SEAT_TYPES) await db.seatType.upsert({ where: { code }, create: { code, name }, update: { name } });
  for (const [code, name, farePerKm, seatsPerCoach, berthLayout] of coachTypes) await db.coachType.upsert({ where: { code }, create: { code, name, farePerKm, seatsPerCoach, berthLayout }, update: { name, farePerKm, seatsPerCoach, berthLayout } });
  for (const [minHoursBefore, chargePercent, label] of [[48, 10, '48 hours or more before departure'], [12, 25, '12-48 hours before departure'], [4, 50, '4-12 hours before departure'], [0, 100, 'Less than 4 hours before departure']] as [number, number, string][]) await db.cancellationRule.upsert({ where: { minHoursBefore }, create: { minHoursBefore, chargePercent, label }, update: { chargePercent, label } });
  await db.appSetting.upsert({ where: { key: 'reservationFee' }, create: { key: 'reservationFee', value: '40' }, update: {} });
  for (const [code, name, city, state] of stations) await db.station.upsert({ where: { code }, create: { code, name, city, state }, update: { name, city, state } });

  const roleId = async (k: string) => (await db.role.findUniqueOrThrow({ where: { key: k } })).id;
  const user = async (email: string, name: string, mobile: string, role: string) => {
    const u = await db.user.upsert({ where: { email }, create: { email, name, mobile, passwordHash: hash }, update: { passwordHash: hash, failedLogins: 0, lockedUntil: null } });
    await db.userRole.deleteMany({ where: { userId: u.id } }); await db.userRole.create({ data: { userId: u.id, roleId: await roleId(role) } });
    await db.notificationPreference.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} }); return u;
  };
  await user('admin@ttb.local', 'Asha Administrator', '9000000001', 'ADMIN'); await user('staff@ttb.local', 'Bala Booking-Staff', '9000000002', 'BOOKING_STAFF');
  await user('operator@ttb.local', 'Omar Operator', '9000000003', 'TRAIN_OPERATOR'); const pax = await user('passenger@ttb.local', 'Priya Passenger', '9000000004', 'PASSENGER');
  if (!(await db.passenger.count({ where: { userId: pax.id } }))) await db.passenger.createMany({ data: [{ userId: pax.id, name: 'Priya Passenger', age: 31, gender: 'FEMALE', mobile: '9000000004' }, { userId: pax.id, name: 'Ravi Passenger', age: 34, gender: 'MALE' }] });

  const st = new Map((await db.station.findMany()).map((s) => [s.code, s.id])); const ct = new Map((await db.coachType.findMany()).map((c) => [c.code, c])); const sty = new Map((await db.seatType.findMany()).map((s) => [s.code, s.id]));
  const prefix: Record<string, string> = { SL: 'S', '1A': 'H', '2A': 'A', '3A': 'B', CC: 'C', '2S': 'D' };
  const from = new Date(); from.setUTCDate(from.getUTCDate() - 30); from.setUTCHours(0, 0, 0, 0);
  for (const t of trains) {
    if (await db.train.findUnique({ where: { number: t.number } })) continue;
    const train = await db.train.create({ data: { number: t.number, name: t.name, type: t.type } });
    const route = await db.trainRoute.create({ data: { trainId: train.id, name: `${t.stops[0][0]} → ${t.stops[t.stops.length - 1][0]}` } });
    await db.trainRouteStation.createMany({ data: t.stops.map(([code, arr, dep, dayOffset, km], i) => ({ routeId: route.id, seq: i + 1, stationId: st.get(code)!, arrivalTime: arr, departureTime: dep, dayOffset, distanceKm: km })) });
    await db.trainSchedule.create({ data: { trainId: train.id, validFrom: from, active: true, notes: 'Regular service', operatingDays: { create: t.days.map((dayOfWeek) => ({ dayOfWeek })) } } });
    for (const [code, count] of t.coaches) for (let n = 1; n <= count; n++) {
      const type = ct.get(code)!; const coach = await db.trainCoach.create({ data: { trainId: train.id, coachTypeId: type.id, number: `${prefix[code]}${n}` } });
      await db.coachSeat.createMany({ data: Array.from({ length: type.seatsPerCoach }, (_, i) => ({ coachId: coach.id, seatNumber: i + 1, seatTypeId: sty.get(seatTypeFor(type.berthLayout, i))! })) });
    }
  }
  console.log('Seed complete: %d stations, %d trains, demo accounts *@ttb.local', await db.station.count(), await db.train.count());
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
