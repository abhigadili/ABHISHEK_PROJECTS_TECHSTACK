import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
export function KpiCard({ label, value, icon, to, hint, loading, tone = 'primary' }: { label: string; value?: ReactNode; icon: ReactNode; to?: string; hint?: ReactNode; loading?: boolean; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' }) {
  const color = { primary: 'text-primary bg-primary-soft', success: 'text-success bg-success/15', warning: 'text-warning bg-warning/15', danger: 'text-danger bg-danger/15', info: 'text-info bg-info/15' }[tone];
  const body = (
    <motion.div whileHover={{ y: -2 }} className="hr-card h-100 p-3 d-flex align-items-center gap-3">
      <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
      <div className="min-w-0"><div className="text-[12px] text-muted">{label}</div>{loading ? <Skeleton className="mt-1 h-6 w-14" /> : <div className="text-xl font-bold leading-tight">{value ?? '—'}</div>}{hint && <div className="text-[11px] text-muted">{hint}</div>}</div>
    </motion.div>
  );
  return to ? <Link to={to} className="d-block h-100 text-decoration-none text-reset">{body}</Link> : body;
}
