import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './router/AppRoutes';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
export function App() {
  return (
    <ErrorBoundary fallbackTitle="The portal hit an unexpected error">
      <AppProviders><BrowserRouter><AppRoutes /></BrowserRouter></AppProviders>
    </ErrorBoundary>
  );
}
