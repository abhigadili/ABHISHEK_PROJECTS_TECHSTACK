import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookingCard } from '@/components/BookingCard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { ErrorState, PageHeader } from '@/components/ui/Feedback';
import { useDocumentTitle } from '@/hooks';
import { get } from '@/services/api';
import { qk } from '@/services/queries';
import type { Booking } from '@/types';

export default function PnrStatus() {
  useDocumentTitle('PNR status'); const [input, setInput] = useState(''); const [pnr, setPnr] = useState('');
  const q = useQuery({ queryKey: qk.pnr(pnr), enabled: /^\d{10}$/.test(pnr), retry: false, queryFn: async () => (await get<Booking>(`/bookings/pnr/${pnr}`)).data });
  const bad = input.length > 0 && !/^\d{10}$/.test(input);
  return (
    <div className="max-w-xl space-y-6"><PageHeader title="PNR status" subtitle="Enter the 10-digit PNR from your ticket" />
      <Card><CardBody><form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (!bad) setPnr(input); }}>
        <Field className="flex-1" label="PNR number" error={bad ? 'PNR is exactly 10 digits' : undefined}><Input inputMode="numeric" maxLength={10} value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))} /></Field>
        <Button type="submit" disabled={input.length !== 10} loading={q.isFetching}>Check</Button></form></CardBody></Card>
      {q.error && <ErrorState error={q.error} />}
      {q.data && <BookingCard b={q.data} />}
      {!pnr && <p className="text-sm text-slate-500">Lost your PNR? Find it under <Link className="text-indigo-600" to="/account/bookings">My bookings</Link>.</p>}
    </div>
  );
}
