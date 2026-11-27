import type { Metadata } from 'next';
import { BookingFlow } from '@/components/common/BookingFlow';
export const metadata: Metadata = { title: 'Passenger details', robots: { index: false } };
/** Server Component shell; the interactive workflow is one Client Component whose state lives in Redux. */
export default function BookPage() { return <BookingFlow />; }
