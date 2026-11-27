import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { RichTextEditor } from '@/components/editors/RichTextEditor';
import { useOp, useOpMutation } from '@/components/op/useOp';
import { LoadingBlock } from '@/components/feedback/states';
import { toast } from 'react-toastify';

/** Exit-interview questionnaire: questions come from GET /exit/interview-form; answers go to POST .../interview/complete. */
export function InterviewDialog({ resignationId, onClose }: { resignationId: string; onClose: () => void }) {
  const { t } = useTranslation(); const form = useOp<any>('exit.form'); const [ans, setAns] = useState<Record<string, string>>({}); const [summary, setSummary] = useState(''); const [rec, setRec] = useState('');
  const m = useOpMutation('exit.completeInterview', { onSuccess: onClose });
  const qs: any[] = form.data?.questions ?? [];
  const submit = () => {
    const missing = qs.find((q) => String(q.required) === 'true' && !ans[q.id]?.trim());
    if (missing) { toast.error(`${t('common.validation.required')}: ${missing.text}`, { toastId: 'iv' }); return; }
    m.mutate({ path: { id: resignationId }, body: { answers: ans, feedbackSummary: summary || undefined, wouldRecommend: rec === '' ? undefined : rec === 'yes' } });
  };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={form.data?.name ?? 'Exit interview'} size="lg" footer={<><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={submit} loading={m.isPending}>{t('common.submit')}</Button></>}>
      {form.isLoading ? <LoadingBlock /> : (
        <div className="d-grid gap-3">
          {qs.map((q) => (
            <div key={q.id}><label className="field-label">{q.text}{String(q.required) === 'true' && <span className="text-danger"> *</span>}</label>
              {q.type === 'RATING' ? <NativeSelect value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</NativeSelect>
                : q.type === 'BOOLEAN' ? <NativeSelect value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })}><option value="">—</option><option>Yes</option><option>No</option></NativeSelect>
                : <Textarea value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} />}</div>))}
          <div><label className="field-label">Feedback summary (HR)</label><RichTextEditor value={summary} onChange={setSummary} height={160} /></div>
          <div><label className="field-label">Would recommend the company?</label><NativeSelect value={rec} onChange={(e) => setRec(e.target.value)}><option value="">—</option><option value="yes">{t('common.yes')}</option><option value="no">{t('common.no')}</option></NativeSelect></div>
        </div>)}
      <span hidden><Input readOnly /></span>
    </Modal>
  );
}
