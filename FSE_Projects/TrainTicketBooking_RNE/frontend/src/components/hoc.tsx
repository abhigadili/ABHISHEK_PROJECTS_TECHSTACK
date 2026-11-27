import { useEffect, type ComponentType } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, useOnlineStatus } from '@/hooks';
import { PageLoader } from '@/components/ui/Feedback';
import type { RoleKey } from '@/types';

/** HOC: only render the wrapped component for signed-in users; otherwise redirect to /login and remember where they were going. */
export function withAuth<P extends object>(Component: ComponentType<P>) {
  const Wrapped = (props: P) => {
    const { isAuthenticated, status } = useAuth(); const loc = useLocation();
    if (status !== 'ready') return <PageLoader />;
    return isAuthenticated ? <Component {...props} /> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  };
  Wrapped.displayName = `withAuth(${Component.displayName ?? Component.name})`; return Wrapped;
}
/** HOC: restrict a component to specific roles (shows the 403 page otherwise). */
export function withRoles<P extends object>(Component: ComponentType<P>, ...roles: RoleKey[]) {
  const Wrapped = (props: P) => { const { hasRole } = useAuth(); return hasRole(...roles) ? <Component {...props} /> : <Navigate to="/403" replace />; };
  Wrapped.displayName = `withRoles(${Component.displayName ?? Component.name})`; return Wrapped;
}
/** HOC: shows an offline banner above any page that needs the network. */
export function withOfflineBanner<P extends object>(Component: ComponentType<P>) {
  const Wrapped = (props: P) => { const online = useOnlineStatus(); return <>{!online && <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">You are offline - showing the last loaded data.</div>}<Component {...props} /></>; };
  Wrapped.displayName = `withOfflineBanner(${Component.displayName ?? Component.name})`; return Wrapped;
}
/** HOC: sets the document title for a page component. */
export function withTitle<P extends object>(Component: ComponentType<P>, title: string) {
  const Wrapped = (props: P) => { useEffect(() => { document.title = `${title} · Train Ticket Booking`; }, []); return <Component {...props} />; };
  Wrapped.displayName = `withTitle(${title})`; return Wrapped;
}
