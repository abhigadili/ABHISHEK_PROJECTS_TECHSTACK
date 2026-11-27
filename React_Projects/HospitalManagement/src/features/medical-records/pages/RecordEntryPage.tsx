import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRecordEntry, useUpdateEntry } from '../hooks/useRecords';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { useCan } from '@/contexts/AuthContext';
import { errorMessage } from '@/services/axios/errors';
import { formatDateTime, humanize } from '@/utils/format';
import type { RecordEntry } from '@/types';
import styles from '../records.module.css';

const REF_ROUTE: Record<string, (id: number) => string> = { PRESCRIPTION: (id) => `/prescriptions/${id}`, LAB_REPORT: (id) => `/lab/requests/${id}`, APPOINTMENT: (id) => `/appointments/${id}` };

export default function RecordEntryPage() {
  const id = Number(useParams().entryId);
  const query = useRecordEntry(id);
  return <QueryBoundary query={query}>{(e) => <EntryDetails entry={e} />}</QueryBoundary>;
}

function EntryDetails({ entry: e }: { entry: RecordEntry }) {
  const canWrite = useCan('records:write');
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(e.title);
  const [details, setDetails] = useState(e.details ?? '');
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateEntry(e.id);
  const editable = canWrite && e.source === 'MANUAL';
  const refTo = e.referenceType && e.referenceId ? REF_ROUTE[e.referenceType]?.(e.referenceId) : undefined;

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim()) return setError('Title is required');
    setError(null);
    try { await update.mutateAsync({ title: title.trim(), details: details.trim() || null }); toast.success('Entry updated'); setEditing(false); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className={styles.page} style={{ maxWidth: 760 }}>
      <PageHeader title={e.title} subtitle={`${humanize(e.entryType)} · ${formatDateTime(e.recordedAt)}`} actions={<><button type="button" className={styles.btn} onClick={() => navigate(`/records/patients/${e.patientId}`)}>Back to record</button>{editable && !editing && <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing(true)}>Edit</button>}</>} />
      <div className={styles.card}>
        {editing ? (
          <form onSubmit={save} noValidate>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <label className={styles.field}>Title<input className={styles.input} value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={200} /></label>
            <label className={styles.field}>Details<textarea className={styles.textarea} value={details} onChange={(ev) => setDetails(ev.target.value)} maxLength={4000} /></label>
            <div className={styles.dialogActions}><button type="button" className={styles.btn} onClick={() => setEditing(false)}>Cancel</button><button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={update.isPending}>Save</button></div>
          </form>
        ) : (
          <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14 }}>{e.details ?? <span className={styles.muted}>No details recorded.</span>}</p>
        )}
        {!editable && !editing && <p className={styles.muted} style={{ marginTop: 12 }}>{e.source === 'EVENT' ? 'Created automatically from a clinical event - read-only.' : 'You do not have permission to edit entries.'}</p>}
      </div>
      <Accordion.Root type="multiple" defaultValue={['meta']}>
        <Accordion.Item value="meta" className={styles.accItem}>
          <Accordion.Header style={{ margin: 0 }}><Accordion.Trigger className={styles.accTrigger}>Entry information <ChevronDown size={16} /></Accordion.Trigger></Accordion.Header>
          <Accordion.Content className={styles.accContent}>
            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, margin: 0 }}>
              {[['Entry id', `#${e.id}`], ['Patient', <Link key="p" to={`/patients/${e.patientId}`} style={{ color: 'var(--hms-accent)' }}>#{e.patientId}</Link>], ['Type', humanize(e.entryType)], ['Source', humanize(e.source)], ['Doctor id', e.doctorId ? `#${e.doctorId}` : '—'], ['Recorded', formatDateTime(e.recordedAt)]].map(([k, v]) => <div key={String(k)}><dt className={styles.countLabel}>{k}</dt><dd style={{ margin: 0, fontSize: 14 }}>{v}</dd></div>)}
            </dl>
          </Accordion.Content>
        </Accordion.Item>
        {refTo && (
          <Accordion.Item value="ref" className={styles.accItem}>
            <Accordion.Header style={{ margin: 0 }}><Accordion.Trigger className={styles.accTrigger}>Source document <ChevronDown size={16} /></Accordion.Trigger></Accordion.Header>
            <Accordion.Content className={styles.accContent}>This entry was generated from {humanize(e.referenceType ?? '')} #{e.referenceId}. <Link to={refTo} style={{ color: 'var(--hms-accent)', fontWeight: 600 }}>Open it</Link></Accordion.Content>
          </Accordion.Item>
        )}
      </Accordion.Root>
    </div>
  );
}
