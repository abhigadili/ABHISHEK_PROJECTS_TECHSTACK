import type { ReactNode } from 'react';
import { motion } from 'motion/react';
export function PageHeader({ title, description, actions, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="d-flex align-items-start gap-2">
        {icon && <div className="mt-1 rounded-lg bg-primary-soft p-2 text-primary">{icon}</div>}
        <div><h1 className="page-title">{title}</h1>{description && <p className="m-0 mt-1 text-[13px] text-muted">{description}</p>}</div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
