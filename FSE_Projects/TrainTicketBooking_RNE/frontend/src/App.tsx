import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { withOfflineBanner } from '@/components/hoc';
import { useAppDispatch } from '@/store';
import { bootstrapSession } from '@/store/authSlice';
import { AppRoutes } from '@/routes';

function Shell() {
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(bootstrapSession()); }, [dispatch]);
  return <ErrorBoundary><AppRoutes /></ErrorBoundary>;
}
export default withOfflineBanner(Shell);
