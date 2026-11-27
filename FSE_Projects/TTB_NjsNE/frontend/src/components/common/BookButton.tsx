'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks';
import { useAppDispatch } from '@/store';
import { trainSelected } from '@/store/bookingSlice';
import type { SearchResult } from '@/types';

/** Starts the booking workflow: stores the chosen train/class in Redux, then navigates programmatically (login first if needed). */
export function BookButton({ result, coachTypeId, disabled }: { result: SearchResult; coachTypeId: number; disabled?: boolean }) {
  const router = useRouter(); const dispatch = useAppDispatch(); const { isAuthenticated } = useAuth();
  return <Button size="sm" disabled={disabled} onClick={() => { dispatch(trainSelected({ result, coachTypeId })); router.push(isAuthenticated ? '/book' : `/login?next=${encodeURIComponent('/book')}`); }}>Book</Button>;
}
