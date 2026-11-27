import { render, type RenderOptions } from '@testing-library/react';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { makeStore, type AppStore } from '@/app/store/store';
import { AppProviders } from '@/app/providers/AppProviders';
import { buildRoutes } from '@/app/router/routes';
import { initialAuthState } from '@/store/slices/authSlice';
import { tokenStore } from '@/api/tokenStore';
import type { Role } from '@/constants/roles';

export const sessionFor = (role: Role, employeeId: number | null = 4) => ({
  status: 'authenticated' as const,
  bootstrapped: true,
  error: null,
  user: { id: 10, email: 'tester@ems.example', role, employeeId },
  profile: {
    id: 10,
    email: 'tester@ems.example',
    role,
    lastLoginAt: null,
    employee: employeeId
      ? {
          id: employeeId,
          employeeCode: 'EMP-1',
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'tester@ems.example',
          status: 'ACTIVE',
          departmentId: 1,
          managerId: null,
        }
      : null,
  },
});

/** A store that is already "logged in" as `role` (skips the login screen; backend calls are still intercepted by msw). */
export function storeFor(role: Role | null, employeeId: number | null = 4): AppStore {
  if (role)
    tokenStore.setTokens({ accessToken: 'test-access', refreshToken: 'test-refresh-token-0123456789' });
  return makeStore({
    auth: role
      ? sessionFor(role, employeeId)
      : { ...initialAuthState, status: 'unauthenticated', bootstrapped: true },
  } as never);
}

/** Render a component inside every provider with a memory router (for hooks/components that need routing context). */
export function renderWithProviders(
  ui: ReactElement,
  {
    role = 'SUPER_ADMIN',
    route = '/',
    path = '*',
    store,
    ...options
  }: { role?: Role | null; route?: string; path?: string; store?: AppStore } & Omit<
    RenderOptions,
    'wrapper'
  > = {},
) {
  const s = store ?? storeFor(role);
  const router = createMemoryRouter([{ path, element: <>{ui}</> }], { initialEntries: [route] });
  const result = render(
    <AppProviders store={s}>
      <RouterProvider router={router} />
    </AppProviders>,
    options,
  );
  return { ...result, store: s, router };
}

/** Render the REAL route table (layouts, guards, loaders, lazy pages) at `route`. */
export function renderApp(route: string, role: Role | null = 'SUPER_ADMIN', employeeId: number | null = 4) {
  const store = storeFor(role, employeeId);
  const router = createMemoryRouter(buildRoutes(store) as RouteObject[], { initialEntries: [route] });
  const result = render(
    <AppProviders store={store}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, store, router };
}

export const Wrapper = ({ children, store }: { children: ReactNode; store: AppStore }) => (
  <AppProviders store={store}>{children}</AppProviders>
);

/* ------------------------------------------------------------------------------------------------------------------ */
import { server, http, API, ok, page } from './server';
import { employee, notifications } from './fixtures';

/** Background calls every authenticated screen makes (header badge, avatar profile) so page tests only mock what they care about. */
export function useLayoutHandlers(over: { unread?: number } = {}) {
  server.use(
    http.get(`${API}/notifications/unread-count`, () => ok({ unread: over.unread ?? 0 })),
    http.get(`${API}/profile`, () => ok(employee())),
    http.get(`${API}/notifications`, () => page(notifications)),
  );
}
