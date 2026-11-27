import { CalendarClock, CalendarDays, FlaskConical, Users } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { appointmentService } from '@/server/services/appointment.service';
import { StatCard } from '@/components/common/StatCard';
export default async function Stats() { const p = await requireRole(['DOCTOR']); const d = await appointmentService.doctorDashboard(p); return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Today" value={d.today.length} icon={<CalendarDays className="size-5" />} /><StatCard label="Upcoming" value={d.upcoming} icon={<CalendarClock className="size-5" />} tone="info" /><StatCard label="Patients" value={d.patients} icon={<Users className="size-5" />} tone="ok" /><StatCard label="Published reports" value={d.publishedReports} icon={<FlaskConical className="size-5" />} tone="warn" /></div>; }
