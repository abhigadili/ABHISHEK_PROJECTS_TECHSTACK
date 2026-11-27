import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import { FilePlus2, FileStack, Pencil } from 'lucide-react';
import { useRecordEntries, useRecordSummary, useSetConditions } from '../hooks/useRecords';
import { EntryRow } from '../components/EntryRow';
import { AddEntryDialog } from '../components/AddEntryDialog';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { VirtualList } from '@/components/tables/VirtualList';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { EmptyState } from '@/components/common/EmptyState';
import { ProfiledSection } from '@/components/common/ProfiledSection';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan } from '@/contexts/AuthContext';
import { RECORD_ENTRY_TYPES, type RecordEntryType } from '@/types';
import { humanize, ageFromDob } from '@/utils/format';
import styles from '../records.module.css';

type TabValue = 'ALL' | RecordEntryType;

/**
 * Patient medical record / medical history. Radix Tabs filter the timeline by entry type (each tab = its own cached query),
 * the timeline is virtualised and its rows are React.memo components, search is derived with useMemo.
 */
export default function PatientRecordPage() {
  const patientId = Number(useParams().patientId);
  const navigate = useNavigate();
  const canWrite = useCan('records:write');
  const [tab, setTab] = useState<TabValue>('ALL');
  const [q, setQ] = useState('');
  const patient = usePatient(patientId);
  const summary = useRecordSummary(patientId);
  const entries = useRecordEntries(patientId, tab === 'ALL' ? undefined : tab);
  const open = useCallback((id: number) => navigate(`/records/entries/${id}`), [navigate]);
  const visible = useMemo(() => {
    const t = q.toLowerCase();
    return (entries.data?.content ?? []).filter((e) => !t || e.title.toLowerCase().includes(t) || (e.details ?? '').toLowerCase().includes(t));
  }, [entries.data, q]);

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={styles.page}>
        <PageHeader
          title={patient.data ? `${patient.data.firstName} ${patient.data.lastName} — medical record` : 'Medical record'}
          subtitle={patient.data ? `Patient #${patient.data.id} · ${ageFromDob(patient.data.dateOfBirth) ?? '—'} y · ${humanize(patient.data.gender)}${patient.data.knownAllergies ? ` · allergies: ${patient.data.knownAllergies}` : ''}` : undefined}
          actions={<>
            <Link to={`/records/documents?patientId=${patientId}`} className={styles.btn}><FileStack size={16} /> Documents</Link>
            {canWrite && <AddEntryDialog patientId={patientId}><button type="button" className={`${styles.btn} ${styles.btnPrimary}`}><FilePlus2 size={16} /> Add entry</button></AddEntryDialog>}
          </>}
        />

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Summary</h2>
          <QueryBoundary query={summary} isEmpty={() => false} skeleton={<Skeleton className="h-20 w-full" />}>
            {(s) => (
              <>
                <div className={styles.counts}>{RECORD_ENTRY_TYPES.map((t) => <div key={t} className={styles.count}><div className={styles.countValue}>{s.entryCounts[t] ?? 0}</div><div className={styles.countLabel}>{humanize(t)}</div></div>)}</div>
                <ChronicConditions patientId={patientId} value={s.chronicConditions} canEdit={canWrite} />
              </>
            )}
          </QueryBoundary>
        </div>

        <div className={styles.card}>
          <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabValue)}>
            <Tabs.List className={styles.tabsList} aria-label="Entry type">
              {(['ALL', ...RECORD_ENTRY_TYPES] as TabValue[]).map((t) => <Tabs.Trigger key={t} value={t} className={styles.tabsTrigger}>{t === 'ALL' ? 'Timeline' : humanize(t)}</Tabs.Trigger>)}
            </Tabs.List>
            <div className={styles.toolbar}>
              <SearchInput onSearch={setQ} placeholder="Search entries…" />
              <span className={styles.muted}>{visible.length} of {entries.data?.totalElements ?? 0} entries</span>
            </div>
            <Tabs.Content value={tab} forceMount>
              <QueryBoundary query={entries} emptyTitle="No entries" emptyDescription={tab === 'ALL' ? 'This patient has no clinical entries yet.' : `No ${humanize(tab).toLowerCase()} entries recorded.`}>
                {() => visible.length === 0 ? <EmptyState title="No entries match your search" /> : (
                  <ProfiledSection id="RecordTimeline">
                    <VirtualList items={visible} getKey={(e) => e.id} estimateSize={112} height={Math.min(560, Math.max(visible.length * 112, 200))} ariaLabel="Clinical timeline" renderItem={(e) => <EntryRow entry={e} onOpen={open} />} />
                  </ProfiledSection>
                )}
              </QueryBoundary>
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

function ChronicConditions({ patientId, value, canEdit }: { patientId: number; value: string | null; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const save = useSetConditions(patientId);
  if (!editing) {
    return (
      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 14 }}><b>Chronic conditions:</b> {value ?? <span className={styles.muted}>none recorded</span>}</p>
        {canEdit && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild><button type="button" className={styles.btn} aria-label="Edit chronic conditions" onClick={() => { setDraft(value ?? ''); setEditing(true); }}><Pencil size={14} /></button></Tooltip.Trigger>
            <Tooltip.Portal><Tooltip.Content className={styles.tooltip} sideOffset={6}>Edit chronic conditions<Tooltip.Arrow /></Tooltip.Content></Tooltip.Portal>
          </Tooltip.Root>
        )}
      </div>
    );
  }
  return (
    <form style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); save.mutate(draft.trim() || null, { onSuccess: () => setEditing(false) }); }}>
      <label className={styles.field}>Chronic conditions<textarea className={styles.textarea} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} style={{ minHeight: 60 }} /></label>
      <div className={styles.dialogActions}><button type="button" className={styles.btn} onClick={() => setEditing(false)}>Cancel</button><button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button></div>
    </form>
  );
}
