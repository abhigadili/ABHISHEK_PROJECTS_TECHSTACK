'use client';
import { useTransition } from 'react';
import { BellRing } from 'lucide-react';
import { sendRemindersAction } from './actions';
import { Button } from '@/components/ui/button';
import { emitToast } from '@/components/ui/toast';
/** Sends appointment reminders for visits in the next 24 h (in production this would be called by a scheduler). */
export function RemindersButton() { const [p, st] = useTransition(); return <Button variant="outline" loading={p} onClick={() => st(async () => { const r = await sendRemindersAction(); emitToast({ kind: r.ok ? 'success' : 'error', text: r.ok ? `${(r.data as { sent: number }).sent} appointment(s) in the next 24 h processed` : r.message ?? '' }); })}><BellRing className="size-4" />Send reminders</Button>; }
