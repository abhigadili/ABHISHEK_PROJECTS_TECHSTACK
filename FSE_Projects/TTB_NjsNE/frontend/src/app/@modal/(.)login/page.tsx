import { LoginForm } from '@/components/forms/LoginForm';
import { RouteModal } from '@/components/common/RouteModal';

/**
 * INTERCEPTING ROUTE + PARALLEL ROUTE: a soft navigation to /login (e.g. clicking "Sign in" in the header) renders this dialog in the
 * root layout's `@modal` slot ON TOP of the current page. A hard load of /login (or a refresh) renders the full page in (auth)/login instead.
 */
export default async function LoginModal({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RouteModal title="Sign in" description="Sign in to manage your bookings."><LoginForm next={next} /></RouteModal>;
}
