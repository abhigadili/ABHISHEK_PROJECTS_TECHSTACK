import { NotificationsView } from '@/features/notifications/NotificationsView';
export const metadata = { title: 'Notifications', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/lab/notifications'>) { return <NotificationsView searchParams={await searchParams} basePath="/lab/notifications" />; }
