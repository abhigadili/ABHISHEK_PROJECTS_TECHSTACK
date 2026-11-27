import { memo } from 'react';
import { Chip, TableCell, TableRow, Typography, IconButton, Tooltip } from '@mui/material';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import type { Patient } from '@/types';
import { ageFromDob, formatDate, humanize } from '@/utils/format';
import { LazyAvatar } from '@/components/common/LazyAvatar';

interface Props {
  patient: Patient;
  canEdit: boolean;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onHover: (id: number) => void;
}

/**
 * React.memo: a row re-renders only when its own `patient` (or the stable callbacks) change - typing in the search box
 * or paging does not re-render the 19 untouched rows. Callbacks come from the parent via useCallback.
 */
export const PatientRow = memo(function PatientRow({ patient: p, canEdit, onOpen, onEdit, onHover }: Props) {
  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(p.id)} onMouseEnter={() => onHover(p.id)}>
      <TableCell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LazyAvatar name={`${p.firstName} ${p.lastName}`} size={36} />
          <div>
            <Typography variant="body2" fontWeight={600}>{p.firstName} {p.lastName}</Typography>
            <Typography variant="caption" color="text.secondary">#{p.id}</Typography>
          </div>
        </div>
      </TableCell>
      <TableCell>{ageFromDob(p.dateOfBirth) ?? '—'} · {humanize(p.gender)}</TableCell>
      <TableCell>{p.bloodGroup ?? '—'}</TableCell>
      <TableCell>
        <Typography variant="body2">{p.email}</Typography>
        <Typography variant="caption" color="text.secondary">{p.phone}</Typography>
      </TableCell>
      <TableCell>{formatDate(p.createdAt)}</TableCell>
      <TableCell><Chip size="small" label={humanize(p.status)} color={p.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /></TableCell>
      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <Tooltip title="View"><IconButton size="small" aria-label={`View ${p.firstName}`} onClick={() => onOpen(p.id)}><VisibilityOutlined fontSize="small" /></IconButton></Tooltip>
        {canEdit && <Tooltip title="Edit"><IconButton size="small" aria-label={`Edit ${p.firstName}`} onClick={() => onEdit(p.id)}><EditOutlined fontSize="small" /></IconButton></Tooltip>}
      </TableCell>
    </TableRow>
  );
});
