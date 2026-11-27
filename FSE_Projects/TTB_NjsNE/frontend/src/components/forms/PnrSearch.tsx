'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

/** PNR search: validates locally, then navigates to ?pnr=... so the Server Component page does the lookup. */
export function PnrSearch() {
  const router = useRouter(); const params = useSearchParams(); const [pending, start] = useTransition(); const [pnr, setPnr] = useState(params.get('pnr') ?? '');
  const bad = pnr.length > 0 && !/^\d{10}$/.test(pnr);
  return (
    <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (!bad && pnr.length === 10) start(() => router.push(`/account/pnr?pnr=${pnr}`)); }}>
      <Field className="flex-1" label="PNR number" error={bad ? 'PNR is exactly 10 digits' : undefined}><Input inputMode="numeric" maxLength={10} value={pnr} onChange={(e) => setPnr(e.target.value.replace(/\D/g, ''))} className="font-mono" /></Field>
      <Button type="submit" disabled={pnr.length !== 10} loading={pending}>Check</Button>
    </form>
  );
}
