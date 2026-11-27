import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { tokens } from '@/api/client/tokens';
import { useAppDispatch, useAppSelector } from '@/store/redux';
import { sessionEnded } from '@/store/redux/authSlice';
import { resumeSession } from '@/features/authentication/authService';

/** Resumes the session at start-up and reacts to forced logouts (refresh failure / revoked token) from the Axios layer. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch(); const qc = useQueryClient(); const { t } = useTranslation();
  const status = useAppSelector((s) => s.auth.status);
  useEffect(() => { resumeSession(); }, []);
  useEffect(() => tokens.onForcedLogout(() => {
    qc.clear(); dispatch(sessionEnded()); toast.warn(t('auth.sessionExpired'), { toastId: 'expired' });
  }), [dispatch, qc, t]);
  if (status === 'unknown') return <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}><div className="skeleton" style={{ width: 160, height: 12 }} /></div>;
  return <>{children}</>;
}
