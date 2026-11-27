'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { enterReportAction } from './actions';
import { Field, Input, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/components/common/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import type { ActionState } from '@/server/http/action';
/** Report entry with optional PDF/image upload: <form action> + FormData (multipart) + useActionState; server validates type/size/magic bytes. */
export function ReportForm({ id, defaults }: { id: number; defaults?: { resultSummary: string; resultDetails: string; referenceRange: string; abnormal: boolean } }) {
  const r = useRouter(); const [s, action] = useActionState<ActionState, FormData>(enterReportAction.bind(null, id), { ok: false }); const e = s.fieldErrors ?? {};
  useEffect(() => { if (s.ok) { emitToast({ kind: 'success', text: 'Report saved' }); r.push('/lab/requests'); r.refresh(); } }, [s, r]);
  return <form action={action} className="max-w-2xl space-y-3" noValidate>{s.message && !s.ok && !Object.keys(e).length && <Alert tone="danger">{s.message}</Alert>}<Field label="Result summary" htmlFor="rs" required error={e.resultSummary}><Textarea id="rs" name="resultSummary" rows={2} defaultValue={defaults?.resultSummary} /></Field><Field label="Details" htmlFor="rd"><Textarea id="rd" name="resultDetails" rows={4} defaultValue={defaults?.resultDetails} /></Field><Field label="Reference range" htmlFor="rr"><Input id="rr" name="referenceRange" defaultValue={defaults?.referenceRange} /></Field><Field label="Report file (PDF/PNG/JPEG, ≤ 5 MB)" htmlFor="file" error={e.file}><Input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="abnormal" className="size-4" defaultChecked={defaults?.abnormal} />Result is abnormal</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publish" className="size-4" defaultChecked />Publish now (notifies the doctor and the patient)</label><SubmitButton pendingText="Saving…">Save report</SubmitButton></form>;
}
