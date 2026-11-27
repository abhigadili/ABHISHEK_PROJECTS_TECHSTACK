import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { NotificationProvider, toastReducer, useNotify, useToasts } from './NotificationContext';
import { ThemeProvider, useThemeMode } from './ThemeContext';
import { AppConfigProvider, useAppConfig } from './AppConfigContext';
import { UserProvider, useCurrentUser } from './UserContext';
import { AuthenticationProvider } from './AuthenticationContext';
import { ToastHost } from '@/components/dialogs/ToastHost';
import { Provider } from 'react-redux';
import { storeFor } from '@/test/utils';
import { http as client } from '@/api/httpClient';
import { server, http, API, fail } from '@/test/server';

describe('toastReducer (useReducer)', () => {
  it('push → dismiss → clear, and caps the queue at 4', () => {
    let s = toastReducer([], { type: 'push', toast: { id: 1, severity: 'info', message: 'a' } });
    for (let i = 2; i <= 6; i += 1)
      s = toastReducer(s, { type: 'push', toast: { id: i, severity: 'info', message: String(i) } });
    expect(s.map((t) => t.id)).toEqual([3, 4, 5, 6]);
    expect(toastReducer(s, { type: 'dismiss', id: 4 }).map((t) => t.id)).toEqual([3, 5, 6]);
    expect(toastReducer(s, { type: 'clear' })).toEqual([]);
  });
});

describe('NotificationContext (provider + toasts via portal)', () => {
  function Emitter() {
    const n = useNotify();
    return <button onClick={() => n.success('Saved!')}>emit</button>;
  }
  it('shows a toast through the portal and auto-dismisses it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <NotificationProvider>
        <Emitter />
        <ToastHost />
      </NotificationProvider>,
    );
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByText('emit'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved!');
    expect(screen.getByRole('status').parentElement).toBe(document.body); // rendered with createPortal, not inside the component tree
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
    });
    expect(screen.queryByText('Saved!')).toBeNull();
  });
  it('emitters do not re-render when the toast list changes (split contexts)', async () => {
    let renders = 0;
    function Counting() {
      renders += 1;
      const n = useNotify();
      return <button onClick={() => n.info('x')}>go</button>;
    }
    render(
      <NotificationProvider>
        <Counting />
        <ToastHost />
      </NotificationProvider>,
    );
    const before = renders;
    await userEvent.click(screen.getByText('go'));
    await userEvent.click(screen.getByText('go'));
    expect(renders).toBe(before);
  });
  it('global HTTP errors (403) surface as toasts through the registered notifier', async () => {
    server.use(http.get(`${API}/forbidden`, () => fail(403, 'FORBIDDEN', 'Insufficient permissions')));
    function Toasts() {
      return (
        <>
          {useToasts().map((t) => (
            <p key={t.id}>{t.message}</p>
          ))}
        </>
      );
    }
    render(
      <NotificationProvider>
        <Toasts />
      </NotificationProvider>,
    );
    await act(async () => {
      await client.get('/forbidden').catch(() => undefined);
    });
    expect(await screen.findByText('Insufficient permissions')).toBeInTheDocument();
  });
  it('useNotify outside the provider throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useNotify())).toThrow(/NotificationProvider/);
    spy.mockRestore();
  });
});

describe('ThemeContext', () => {
  it('toggles light/dark and persists the choice', () => {
    const { result } = renderHook(() => useThemeMode(), {
      wrapper: ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>,
    });
    act(() => result.current.setMode('light'));
    expect(result.current.mode).toBe('light');
    act(() => result.current.toggle());
    expect(result.current.mode).toBe('dark');
    expect(JSON.parse(localStorage.getItem('ems.theme')!)).toBe('dark');
  });
});

describe('AppConfigContext', () => {
  it('provides defaults and allows overrides (static config: Context is enough)', () => {
    const { result } = renderHook(() => useAppConfig(), {
      wrapper: ({ children }) => (
        <AppConfigProvider overrides={{ appName: 'Acme HR' }}>{children}</AppConfigProvider>
      ),
    });
    expect(result.current.appName).toBe('Acme HR');
    expect(result.current.pageSizeOptions).toContain(25);
  });
});

describe('Provider composition: Authentication ▸ User (nested providers)', () => {
  it('UserContext derives the display name, initials and role label from the authenticated session', () => {
    const store = storeFor('HR_ADMIN', 4);
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: ({ children }) => (
        <Provider store={store}>
          <NotificationProvider>
            <AuthenticationProvider>
              <UserProvider>{children}</UserProvider>
            </AuthenticationProvider>
          </NotificationProvider>
        </Provider>
      ),
    });
    expect(result.current).toMatchObject({
      displayName: 'Test User',
      initials: 'TU',
      roleLabel: 'HR Admin',
      employeeId: 4,
    });
  });
  it('useCurrentUser outside UserProvider throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useCurrentUser())).toThrow(/UserProvider/);
    spy.mockRestore();
  });
});
