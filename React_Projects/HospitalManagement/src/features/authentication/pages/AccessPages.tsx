import { Link, useLocation } from 'react-router-dom';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** 401 page: reached when a session cannot be established or has been revoked. */
export function UnauthorizedPage() {
  useDocumentTitle('Unauthorized');
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <LockKeyhole className="h-12 w-12 text-amber-500" />
      <h1 className="text-2xl font-bold">401 · Sign in required</h1>
      <p className="text-sm text-muted">You need to sign in to see this page.</p>
      <Button asChild><Link to="/login">Go to sign in</Link></Button>
    </div>
  );
}

/** 403 page: signed in, but the role is not allowed to use this area. */
export function AccessDeniedPage() {
  useDocumentTitle('Access denied');
  const { user } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="h-12 w-12 text-red-500" />
      <h1 className="text-2xl font-bold">403 · Access denied</h1>
      <p className="text-sm text-muted">
        Your role ({user?.role.toLowerCase().replace('_', ' ') ?? 'unknown'}) is not allowed to open {from ? <code className="rounded bg-surface-alt px-1">{from}</code> : 'this page'}.
      </p>
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-5xl font-bold text-brand-600">404</h1>
      <p className="text-sm text-muted">The page you are looking for does not exist.</p>
      <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}
