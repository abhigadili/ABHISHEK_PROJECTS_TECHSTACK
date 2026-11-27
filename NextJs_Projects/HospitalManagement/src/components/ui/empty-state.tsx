import type { ReactNode } from 'react';
import { Inbox, TriangleAlert } from 'lucide-react';
export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-line bg-surface px-6 py-12 text-center">
      <div className="text-muted">{icon ?? <Inbox className="size-8" />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
export function ErrorState({ title = 'Something went wrong', message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-danger/40 bg-danger/5 px-6 py-10 text-center">
      <TriangleAlert className="size-8 text-danger" />
      <p className="font-medium">{title}</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
export const Alert = ({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode }) => {
  const c = { info: 'border-info/40 bg-info/10', warn: 'border-warn/40 bg-warn/10', danger: 'border-danger/40 bg-danger/10', ok: 'border-ok/40 bg-ok/10' }[tone];
  return <div role={tone === 'danger' ? 'alert' : 'note'} className={`rounded-lg border px-4 py-3 text-sm ${c}`}>{children}</div>;
};
