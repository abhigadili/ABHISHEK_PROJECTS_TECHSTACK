import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardList, FileStack } from 'lucide-react';
import { PatientPicker } from '@/components/common/PatientPicker';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/Spinner';
import { Notice } from '@/components/common/Notice';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import type { Patient } from '@/types';
import styles from '../records.module.css';

/** Medical Records entry point: patients go straight to their own record; staff pick a patient. (Radix + CSS Modules module) */
export default function RecordsHomePage() {
  const { role } = useAuth();
  const own = useCurrentPatient();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Patient | null>(null);
  if (role === 'PATIENT') {
    if (own.isPending) return <PageLoader />;
    if (own.patient) return <Navigate to={`/records/patients/${own.patient.id}`} replace />;
    return <Notice tone="warning" title="No patient profile">Create your patient profile to see a medical record. <Link to="/register" className="font-semibold underline">Register</Link></Notice>;
  }
  return (
    <>
      <PageHeader title="Medical records" subtitle="Open a patient's clinical file" icon={<ClipboardList className="h-5 w-5" />} actions={<Link to="/records/documents" className={styles.btn}><FileStack size={16} /> Medical documents</Link>} />
      <div className={styles.card} style={{ maxWidth: 560 }}>
        <p className={styles.muted} style={{ marginBottom: 12 }}>The Medical Records Service stores a timeline per patient (diagnoses, visits, lab reports, prescriptions, allergies and notes). Search for a patient to open it.</p>
        <PatientPicker value={picked} onChange={(p) => { setPicked(p); if (p) navigate(`/records/patients/${p.id}`); }} autoFocus />
      </div>
    </>
  );
}
