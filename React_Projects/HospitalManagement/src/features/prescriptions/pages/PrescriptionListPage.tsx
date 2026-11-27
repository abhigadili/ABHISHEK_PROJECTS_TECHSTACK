import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FilePlus2, FileText } from 'lucide-react';
import { useDoctorPrescriptions, usePatientPrescriptions } from '../hooks/usePrescriptions';
import { useCurrentDoctor, useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { useDoctorList } from '@/features/doctors/hooks/useDoctors';
import { PatientPicker } from '@/components/common/PatientPicker';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageLoader } from '@/components/common/Spinner';
import { Notice } from '@/components/common/Notice';
import { PrescriptionStatusBadge } from '@/components/common/StatusBadge';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { formatDate } from '@/utils/format';
import { PRESCRIPTION_STATUSES } from '../constants';
import type { Patient, Prescription, PrescriptionStatus } from '@/types';

/**
 * Prescription list / patient prescription history / doctor prescription history.
 *   PATIENT -> own history   DOCTOR -> own issued prescriptions   ADMIN -> by doctor or by patient   PHARMACIST -> by patient
 * `/prescriptions/history/:patientId` pre-selects a patient (history view).
 */
export default function PrescriptionListPage() {
  const { role } = useAuth();
  const canCreate = useCan('prescriptions:create');
  const { patientId: historyId } = useParams();
  const own = useCurrentPatient();
  const myDoctor = useCurrentDoctor();
  const [picked, setPicked] = useState<Patient | null>(null);
  const [mode, setMode] = useState<'patient' | 'doctor'>(role === 'ADMIN' ? 'doctor' : 'patient');
  const [doctorId, setDoctorId] = useState<number>(0);
  const doctors = useDoctorList({ size: 100 });
  const fromUrl = usePatient(Number(historyId) || 0, !!historyId && role !== 'PATIENT');

  const patientId = role === 'PATIENT' ? (own.patient?.id ?? 0) : (picked?.id ?? (Number(historyId) || 0));
  const effectiveDoctorId = role === 'DOCTOR' && mode === 'doctor' ? (myDoctor.doctor?.id ?? 0) : mode === 'doctor' ? doctorId : 0;
  const byPatient = usePatientPrescriptions(mode === 'patient' || role === 'PATIENT' ? patientId : 0);
  const byDoctor = useDoctorPrescriptions(role !== 'PATIENT' && mode === 'doctor' ? effectiveDoctorId : 0);
  const query = role !== 'PATIENT' && mode === 'doctor' ? byDoctor : byPatient;
  const ready = role === 'PATIENT' ? patientId > 0 : mode === 'patient' ? patientId > 0 : effectiveDoctorId > 0;

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PrescriptionStatus | ''>('');
  const navigate = useNavigate();
  const filter = (rows: Prescription[]) => rows.filter((p) => (!status || p.status === status) && (!q || [p.patientName, p.doctorName, p.diagnosis ?? '', ...p.items.map((i) => i.medicineName), String(p.id)].some((x) => x.toLowerCase().includes(q.toLowerCase()))));
  const columns = useMemo<Column<Prescription>[]>(() => [
    { key: 'id', header: 'Rx', cell: (p) => <span className="font-semibold">#{p.id}</span> },
    { key: 'issued', header: 'Issued', cell: (p) => formatDate(p.issuedAt) },
    ...(role !== 'PATIENT' ? [{ key: 'patient', header: 'Patient', cell: (p: Prescription) => p.patientName }] : []),
    { key: 'doctor', header: 'Doctor', cell: (p) => p.doctorName },
    { key: 'dx', header: 'Diagnosis', cell: (p) => <span className="line-clamp-1 max-w-[14rem]">{p.diagnosis ?? '—'}</span> },
    { key: 'meds', header: 'Medicines', cell: (p) => <span className="line-clamp-1 max-w-[16rem] text-muted">{p.items.map((i) => i.medicineName).join(', ')}</span> },
    { key: 'valid', header: 'Valid until', cell: (p) => formatDate(p.validUntil) },
    { key: 'status', header: 'Status', cell: (p) => <PrescriptionStatusBadge status={p.status} /> },
  ], [role]);

  if (role === 'PATIENT' && own.isPending) return <PageLoader />;
  return (
    <>
      <PageHeader title={historyId ? 'Prescription history' : 'Prescriptions'} subtitle={fromUrl.data ? `${fromUrl.data.firstName} ${fromUrl.data.lastName}` : 'Issued prescriptions and their status'} icon={<FileText className="h-5 w-5" />} actions={canCreate && <Button asChild><Link to="/prescriptions/new"><FilePlus2 className="h-4 w-4" /> New prescription</Link></Button>} />
      {role === 'PATIENT' && own.missingProfile && <Notice tone="warning">Create your patient profile to see prescriptions.</Notice>}
      {(role === 'ADMIN') && (
        <div className="mb-4 inline-flex rounded-lg bg-surface-alt p-1" role="tablist">{(['doctor', 'patient'] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? 'bg-surface shadow' : 'text-muted'}`}>By {m}</button>)}</div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {role !== 'PATIENT' && mode === 'patient' && <div className="w-full max-w-sm"><PatientPicker value={picked ?? fromUrl.data ?? null} onChange={(p) => { setPicked(p); if (historyId) navigate('/prescriptions'); }} /></div>}
        {role === 'ADMIN' && mode === 'doctor' && <label className="text-xs font-medium text-muted">Doctor<select value={doctorId} onChange={(e) => setDoctorId(Number(e.target.value))} className="mt-1 block h-9 min-w-[14rem] rounded-md border border-line bg-surface px-2 text-sm text-fg"><option value={0}>Select a doctor</option>{doctors.data?.content.map((d) => <option key={d.id} value={d.id}>{d.fullName} — {d.specialization}</option>)}</select></label>}
        {ready && <SearchInput onSearch={setQ} placeholder="Search medicine, diagnosis…" />}
        {ready && <label className="text-xs font-medium text-muted">Status<select value={status} onChange={(e) => setStatus(e.target.value as PrescriptionStatus | '')} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg"><option value="">All</option>{PRESCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select></label>}
      </div>
      {!ready ? (role === 'PATIENT' ? null : <Notice>{mode === 'patient' ? 'Search for a patient to see their prescriptions.' : role === 'DOCTOR' ? 'No doctor profile is linked to your login.' : 'Choose a doctor to see the prescriptions they issued.'}</Notice>) : (
        <QueryBoundary query={query} emptyTitle="No prescriptions" emptyDescription="Nothing has been prescribed yet.">
          {(rows) => {
            const f = filter(rows);
            return f.length === 0 ? <Notice>No prescriptions match the filters.</Notice> : <DataTable caption="Prescriptions" columns={columns} rows={f} rowKey={(p) => p.id} onRowClick={(p) => navigate(`/prescriptions/${p.id}`)} />;
          }}
        </QueryBoundary>
      )}
    </>
  );
}
