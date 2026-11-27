import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { requireUser } from '@/lib/server/session';
import { AuthProvider } from '@/providers/AuthProvider';

/** Protected layout for the checkout flow: passengers, staff and admins can book (Express enforces `booking:create`). */
export default async function BookingLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(['PASSENGER', 'ADMIN', 'BOOKING_STAFF']);
  return <AuthProvider initialUser={user}><div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-8">{children}</main></div></AuthProvider>;
}
