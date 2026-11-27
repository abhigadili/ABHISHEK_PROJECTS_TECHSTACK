import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
export function StatCard({ label, value, icon, hint, tone = 'primary' }: { label: string; value: ReactNode; icon?: ReactNode; hint?: string; tone?: 'primary' | 'ok' | 'warn' | 'info' }) {
  const t = { primary: 'bg-primary/10 text-primary', ok: 'bg-ok/10 text-ok', warn: 'bg-warn/10 text-warn', info: 'bg-info/10 text-info' }[tone];
  return (
    <Card className="flex items-center gap-4 p-4">
      {icon && <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${t}`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs leading-tight tracking-wide text-muted uppercase">{label}</p>
        <p className="num text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
