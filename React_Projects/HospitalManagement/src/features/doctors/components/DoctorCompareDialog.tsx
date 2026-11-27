import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import type { Doctor, Department, Hospital } from '@/types';
import { formatCurrency } from '@/utils/format';

/** Side-by-side comparison of up to three doctors picked in the Redux compare tray (MUI Dialog renders in a portal). */
export function DoctorCompareDialog({ open, onClose, doctors, directory }: { open: boolean; onClose: () => void; doctors: Doctor[]; directory: Map<number, { department: Department; hospital: Hospital }> }) {
  const rows: { label: string; get: (d: Doctor) => string }[] = [
    { label: 'Specialization', get: (d) => d.specialization },
    { label: 'Qualification', get: (d) => d.qualification ?? '—' },
    { label: 'Experience', get: (d) => (d.experienceYears !== null ? `${d.experienceYears} years` : '—') },
    { label: 'Consultation fee', get: (d) => formatCurrency(d.consultationFee) },
    { label: 'Department', get: (d) => (d.departmentId ? (directory.get(d.departmentId)?.department.name ?? `#${d.departmentId}`) : '—') },
    { label: 'Hospital', get: (d) => directory.get(d.departmentId ?? -1)?.hospital.name ?? `#${d.hospitalId}` },
    { label: 'Status', get: (d) => (d.active ? 'Active' : 'Inactive') },
  ];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="cmp-title">
      <DialogTitle id="cmp-title">Compare doctors</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead><TableRow><TableCell />{doctors.map((d) => <TableCell key={d.id} sx={{ fontWeight: 700 }}>{d.fullName}</TableCell>)}</TableRow></TableHead>
          <TableBody>{rows.map((r) => <TableRow key={r.label}><TableCell sx={{ color: 'text.secondary' }}>{r.label}</TableCell>{doctors.map((d) => <TableCell key={d.id}>{r.get(d)}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
