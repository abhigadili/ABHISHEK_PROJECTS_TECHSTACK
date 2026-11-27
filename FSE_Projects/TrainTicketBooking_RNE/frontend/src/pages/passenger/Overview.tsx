import { Link } from 'react-router-dom';
import { BookingCard } from '@/components/BookingCard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useAuth, useDocumentTitle } from '@/hooks';
import { useBookings } from '@/services/queries';

export default function Overview() {
  useDocumentTitle('My account'); const { user } = useAuth(); const up = useBookings({ scope: 'upcoming', size: 3 });
  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user?.name.split(' ')[0]}`} subtitle="Your trips at a glance" actions={<Button asChild><Link to="/">Book a ticket</Link></Button>} />
      <Card><CardHeader><CardTitle>Upcoming journeys</CardTitle><Link className="text-sm text-indigo-600" to="/account/bookings">View all</Link></CardHeader><CardBody className="space-y-3">
        {up.isLoading ? <Skeleton className="h-20" /> : up.error ? <ErrorState error={up.error} onRetry={up.refetch} /> : up.data!.data.length === 0 ? <EmptyState title="No upcoming trips" hint="Search for a train to plan your next journey." /> : up.data!.data.map((b) => <BookingCard key={b.id} b={b} />)}
      </CardBody></Card>
    </div>
  );
}
