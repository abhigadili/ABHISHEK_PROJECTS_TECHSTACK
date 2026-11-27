import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './router';
import { ErrorBoundary } from '@/components/error-boundaries/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary label="root">
      <AppProviders>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}
