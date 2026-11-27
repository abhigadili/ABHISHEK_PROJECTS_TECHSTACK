import { NotificationsView } from '@/features/notifications/NotificationsView';
export const metadata = { title: 'Notifications', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/billing/notifications'>) { return <NotificationsView searchParams={await searchParams} basePath="/billing/notifications" />; }
