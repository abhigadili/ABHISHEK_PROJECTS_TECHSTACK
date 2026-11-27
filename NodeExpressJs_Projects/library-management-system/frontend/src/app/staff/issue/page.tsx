'use client';
import { Redo2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BookPicker, MemberPicker, type MemberLite } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, PageHeader, Select, TextInput } from '@/components/ui';
import { errMsg } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { fmtDate, money, tomorrowISO } from '@/lib/format';
import type { Book, Loan } from '@/lib/types';

export default function IssuePage() {
  const toast = useToast();
  const [member, setMember] = useState<MemberLite | null>(null); const [mode, setMode] = useState<'book' | 'accession'>('book');
  const [book, setBook] = useState<Book | null>(null); const [accession, setAccession] = useState(''); const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState<Loan | null>(null);

  const submit = async () => {
    if (!member) return; setBusy(true); setError(null); setDone(null);
    try {
      const body: Record<string, unknown> = { memberId: member.id };
      if (mode === 'book') body.bookId = book!.id; else body.accessionNumber = accession.trim();
      if (due) body.dueDate = due;
      const loan = await api.post<Loan>('/loans/issue', body);
      setDone(loan); toast.success(`Issued “${loan.bookTitle}” to ${member.fullName}`); setBook(null); setAccession(''); setDue('');
      const fresh = await api.getPaged<MemberLite>(`/members?q=${encodeURIComponent(member.memberCode)}`); setMember(fresh.data.find((m) => m.id === member.id) ?? member);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };
  const ready = !!member && (mode === 'book' ? !!book : accession.trim().length > 0);
  return (
    <>
      <PageHeader title="Issue books" subtitle="Check out a copy to a member. Limits, membership validity, overdue items and unpaid fines are checked for you." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="1. Member"><MemberPicker value={member} onChange={(m) => { setMember(m); setDone(null); setError(null); }} />
          {member && (member.status !== 'active' || (member.membershipEnd && member.membershipEnd < new Date().toISOString().slice(0, 10)) || member.outstandingFines > 0) && <div className="mt-3 space-y-2">{member.status !== 'active' && <Alert>Account is {member.status}.</Alert>}{member.membershipEnd && member.membershipEnd < new Date().toISOString().slice(0, 10) && <Alert>Membership expired on {fmtDate(member.membershipEnd)}.</Alert>}{member.outstandingFines > 0 && <Alert tone="amber">Outstanding fines: {money(member.outstandingFines)} — <Link className="underline" href={`/staff/payments?memberId=${member.id}`}>record a payment</Link>.</Alert>}</div>}
        </Card>
        <Card title="2. Book or copy">
          <div className="space-y-4">
            <Select label="Find by" value={mode} onChange={(e) => setMode(e.target.value as 'book' | 'accession')}><option value="book">Search the catalogue</option><option value="accession">Scan / type accession number</option></Select>
            {mode === 'book' ? <BookPicker value={book} onChange={setBook} availableOnly /> : <TextInput label="Accession number" placeholder="e.g. ACC-00003-1" value={accession} onChange={(e) => setAccession(e.target.value)} />}
            <TextInput label="Due date (optional)" type="date" min={tomorrowISO()} value={due} onChange={(e) => setDue(e.target.value)} hint="Leave empty to use the membership type’s loan period." />
          </div>
        </Card>
      </div>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {done && <div className="mt-4"><Alert tone="green">Issued <strong>{done.bookTitle}</strong> (copy {done.accessionNumber}) — due <strong>{fmtDate(done.dueDate)}</strong>. <Link href={`/staff/loans?q=${encodeURIComponent(done.memberCode)}`} className="underline">View loans</Link></Alert></div>}
      <div className="mt-6"><Button onClick={submit} loading={busy} disabled={!ready}><Redo2 className="h-4 w-4" />Issue book</Button></div>
    </>
  );
}
