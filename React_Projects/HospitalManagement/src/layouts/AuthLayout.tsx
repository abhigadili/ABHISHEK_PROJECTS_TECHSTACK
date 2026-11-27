import { Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { HeartPulse, ShieldCheck, CalendarCheck, FlaskConical } from 'lucide-react';
import { PageLoader } from '@/components/common/Spinner';
import { ErrorBoundary } from '@/components/error-boundaries/ErrorBoundary';

/** Public layout (login / registration): brand panel (CSS Grid) + form column. */
export default function AuthLayout() {
  const wide = useLocation().pathname.startsWith('/register'); // the registration wizard needs a wider form column
  return (
    <div className={wide ? 'grid min-h-screen' : 'grid min-h-screen lg:grid-cols-[1.1fr_1fr]'}>
      <section className={`relative ${wide ? 'hidden lg:hidden' : 'hidden lg:flex'} flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 to-[#0f2744] p-10 text-white`}>
        <div className="flex items-center gap-2 text-lg font-bold"><HeartPulse className="h-7 w-7" /> HospitalCare</div>
        <div className="max-w-md space-y-6">
          <h2 className="text-4xl font-bold leading-tight">One workspace for every part of patient care.</h2>
          <ul className="space-y-3 text-brand-100">
            <li className="flex items-center gap-3"><CalendarCheck className="h-5 w-5" /> Book and manage appointments in real time</li>
            <li className="flex items-center gap-3"><FlaskConical className="h-5 w-5" /> Lab requests, results and reports</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /> Role-based access to clinical and billing data</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200">Hospital Management System · React frontend</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className={wide ? 'w-full max-w-3xl' : 'w-full max-w-md'}>
          <ErrorBoundary label="auth-layout">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </section>
    </div>
  );
}
