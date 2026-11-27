'use server';
import { revalidatePath } from 'next/cache';
import { notificationService } from '@/server/services/notification.service';
import { appointmentService } from '@/server/services/appointment.service';
import { run } from '@/server/http/action';
const bust = () => revalidatePath('/', 'layout');
export async function markReadAction(id: number) { const r = await run((p) => notificationService.markRead(p, id)); if (r.ok) bust(); return { ok: r.ok }; }
export async function markAllReadAction() { const r = await run((p) => notificationService.markAllRead(p), 'All marked as read'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
export async function sendRemindersAction() { return run((p) => appointmentService.sendDueReminders(p).then((n) => ({ sent: n })), 'Reminders processed'); }
