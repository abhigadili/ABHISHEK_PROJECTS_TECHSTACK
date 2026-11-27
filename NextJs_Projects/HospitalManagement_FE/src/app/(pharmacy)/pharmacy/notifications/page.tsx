import { NotificationsView } from '@/features/notifications/NotificationsView';
export const metadata = { title: 'Notifications', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/pharmacy/notifications'>) { return <NotificationsView searchParams={await searchParams} basePath="/pharmacy/notifications" />; }
