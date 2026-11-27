import { memo } from 'react';
import type { RecordEntry, RecordEntryType } from '@/types';
import { formatDateTime, humanize } from '@/utils/format';
import styles from '../records.module.css';

const COLORS: Record<RecordEntryType, string> = { DIAGNOSIS: '#dc2626', VISIT: '#2563eb', LAB_REPORT: '#7c3aed', PRESCRIPTION: '#0d9488', ALLERGY: '#d97706', NOTE: '#64748b' };
const ABBR: Record<RecordEntryType, string> = { DIAGNOSIS: 'Dx', VISIT: 'Vis', LAB_REPORT: 'Lab', PRESCRIPTION: 'Rx', ALLERGY: 'All', NOTE: 'Note' };

/** React.memo row of the (virtualised) timeline: re-renders only when its own entry changes. */
export const EntryRow = memo(function EntryRow({ entry: e, onOpen }: { entry: RecordEntry; onOpen: (id: number) => void }) {
  return (
    <div className={styles.entry} role="button" tabIndex={0} onClick={() => onOpen(e.id)} onKeyDown={(ev) => ev.key === 'Enter' && onOpen(e.id)} aria-label={`${humanize(e.entryType)}: ${e.title}`}>
      <div className={styles.entryIcon} style={{ background: COLORS[e.entryType] }}>{ABBR[e.entryType]}</div>
      <div className={styles.entryBody}>
        <div className={styles.entryTitle}>{e.title}</div>
        <div className={styles.entryMeta}>{formatDateTime(e.recordedAt)} · {humanize(e.entryType)} · <span className={styles.badge}>{e.source === 'EVENT' ? 'auto' : 'manual'}</span></div>
        {e.details && <div className={styles.entryDetails}>{e.details}</div>}
      </div>
    </div>
  );
});
