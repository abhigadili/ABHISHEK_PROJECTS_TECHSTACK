import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { store } from '@/app/store/store';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppRouter } from '@/app/router/routes';

export default function App() {
  const router = useMemo(() => createAppRouter(store), []); // one router for the app's lifetime
  return (
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
