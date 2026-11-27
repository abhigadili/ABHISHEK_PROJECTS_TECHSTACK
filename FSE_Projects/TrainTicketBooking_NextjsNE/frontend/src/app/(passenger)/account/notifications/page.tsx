import type { Metadata } from 'next';
import { NotificationFeed } from '@/components/common/NotificationFeed';
import { PageHeader } from '@/components/ui/Feedback';
import { getNotifications } from '@/features/bookings/server';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };
export default async function NotificationsPage() {
  const { items, meta } = await getNotifications(0, 10);
  return <div><PageHeader title="Notifications" subtitle="Booking, payment, refund and schedule updates" /><NotificationFeed initial={{ data: items, meta }} /></div>;
}
