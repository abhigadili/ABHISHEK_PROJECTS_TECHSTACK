import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useDebounce } from './useDebounce';
import { usePagination } from './usePagination';
import { useLocalStorage } from './useLocalStorage';
import { useModal } from './useModal';
import { useApi } from './useApi';
import { usePermissions } from './usePermissions';
import { useAuth } from './useAuth';
import { useNotifications } from './useNotifications';
import { useFormValidation } from './useFormValidation';
import { useEmployees, parseEmployeeFilters } from './useEmployees';
import { useDepartmentFilter, useDepartments } from './useDepartments';
import { useOnlineStatus } from './useOnlineStatus';
import { Wrapper, storeFor } from '@/test/utils';
import { server, http, API, ok, page } from '@/test/server';
import { departments, employees } from '@/test/fixtures';
import type { Role } from '@/constants/roles';

const withStore = (role: Role | null) => {
  const store = storeFor(role);
  return ({ children }: { children: ReactNode }) => (
    <Wrapper store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Wrapper>
  );
};

describe('useDebounce', () => {
  it('emits only after the value stops changing', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('abc');
  });
  it('clears its timer on unmount (no leak)', () => {
    vi.useFakeTimers();
    const { unmount, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('usePagination', () => {
  it('starts at page 1, moves, clamps, and resets the page when the size changes', () => {
    const { result } = renderHook(() => usePagination({ initialLimit: 10 }));
    expect(result.current).toMatchObject({ page: 1, limit: 10 });
    act(() => result.current.next(3));
    act(() => result.current.next(3));
    act(() => result.current.next(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.prev());
    expect(result.current.page).toBe(2);
    act(() => result.current.setLimit(25));
    expect(result.current).toMatchObject({ page: 1, limit: 25 });
    act(() => result.current.prev());
    expect(result.current.page).toBe(1); // never below 1
  });
});

describe('useLocalStorage (useSyncExternalStore)', () => {
  it('returns the initial value, persists updates and supports functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('k1', 5));
    expect(result.current[0]).toBe(5);
    act(() => result.current[1](6));
    expect(result.current[0]).toBe(6);
    expect(localStorage.getItem('k1')).toBe('6');
    act(() => result.current[1]((p) => p + 1));
    expect(result.current[0]).toBe(7);
  });
  it('keeps every consumer of the same key in sync', () => {
    const a = renderHook(() => useLocalStorage('shared', 'x'));
    const b = renderHook(() => useLocalStorage('shared', 'x'));
    act(() => a.result.current[1]('changed'));
    expect(b.result.current[0]).toBe('changed');
  });
  it('reacts to changes from another tab (native storage event)', () => {
    const { result } = renderHook(() => useLocalStorage('tab', 'a'));
    act(() => {
      localStorage.setItem('tab', JSON.stringify('from-other-tab'));
      window.dispatchEvent(new StorageEvent('storage', { key: 'tab' }));
    });
    expect(result.current[0]).toBe('from-other-tab');
  });
  it('falls back to the initial value on corrupt JSON and supports remove()', () => {
    localStorage.setItem('bad', '{not json');
    const { result } = renderHook(() => useLocalStorage('bad', 'fallback'));
    expect(result.current[0]).toBe('fallback');
    act(() => result.current[1]('ok'));
    act(() => result.current[2]());
    expect(result.current[0]).toBe('fallback');
  });
});

describe('useModal', () => {
  it('opens with a payload and closes', () => {
    const { result } = renderHook(() => useModal<{ id: number }>());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open({ id: 9 }));
    expect(result.current).toMatchObject({ isOpen: true, data: { id: 9 } });
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});

describe('useApi (generic async hook)', () => {
  it('loads immediately and exposes data', async () => {
    const { result } = renderHook(() => useApi(async () => 42, { immediate: true }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
  });
  it('captures errors as a message', async () => {
    const { result } = renderHook(() =>
      useApi(
        async () => {
          throw new Error('nope');
        },
        { immediate: true },
      ),
    );
    await waitFor(() => expect(result.current.error).toBe('nope'));
  });
  it('aborts the in-flight request on unmount (cleanup)', async () => {
    let aborted = false;
    const { unmount } = renderHook(() =>
      useApi(
        (signal) =>
          new Promise<string>((_, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
        { immediate: true },
      ),
    );
    unmount();
    await waitFor(() => expect(aborted).toBe(true));
  });
  it('ignores a stale response when a newer run supersedes it', async () => {
    const delays: Record<string, number> = { slow: 60, fast: 5 };
    const { result } = renderHook(() =>
      useApi(
        (signal, which: string) =>
          new Promise<string>((resolve, reject) => {
            const t = setTimeout(() => resolve(which), delays[which]);
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new DOMException('x', 'AbortError'));
            });
          }),
      ),
    );
    act(() => {
      void result.current.run('slow');
    });
    await act(async () => {
      await result.current.run('fast');
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(result.current.data).toBe('fast');
  });
  it('reset clears state', async () => {
    const { result } = renderHook(() => useApi(async () => 'v', { immediate: true }));
    await waitFor(() => expect(result.current.data).toBe('v'));
    act(() => result.current.reset());
    expect(result.current.data).toBeUndefined();
  });
});

describe('useAuth / usePermissions', () => {
  it('useAuth throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(/inside <AuthenticationProvider>/);
    spy.mockRestore();
  });
  it('exposes the signed-in user from Redux through Context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: withStore('MANAGER') });
    expect(result.current).toMatchObject({
      isAuthenticated: true,
      isBootstrapping: false,
      user: { role: 'MANAGER' },
    });
  });
  it.each<[Role, Record<string, boolean>]>([
    [
      'SUPER_ADMIN',
      { 'employee:manage': true, 'users:set-role': true, 'leave:approve': true, 'reports:admin': true },
    ],
    [
      'HR_ADMIN',
      { 'employee:manage': true, 'users:set-role': false, 'leave:approve': true, 'reports:admin': true },
    ],
    [
      'MANAGER',
      { 'employee:manage': false, 'users:set-role': false, 'leave:approve': true, 'reports:admin': false },
    ],
    [
      'EMPLOYEE',
      { 'employee:manage': false, 'users:set-role': false, 'leave:approve': false, 'reports:admin': false },
    ],
  ])('%s permissions mirror the backend authorize() calls', (role, expected) => {
    const { result } = renderHook(() => usePermissions(), { wrapper: withStore(role) });
    for (const [perm, allowed] of Object.entries(expected))
      expect(result.current.can(perm as never)).toBe(allowed);
  });
  it('hasRole and signed-out behaviour', () => {
    const a = renderHook(() => usePermissions(), { wrapper: withStore('HR_ADMIN') });
    expect(a.result.current.hasRole('HR_ADMIN', 'SUPER_ADMIN')).toBe(true);
    expect(a.result.current.hasRole('EMPLOYEE')).toBe(false);
    const out = renderHook(() => usePermissions(), { wrapper: withStore(null) });
    expect(out.result.current.can('dashboard:view')).toBe(false);
  });
});

describe('useNotifications (polling)', () => {
  it('polls the unread count immediately and on an interval, and stops when unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let calls = 0;
    server.use(
      http.get(`${API}/notifications/unread-count`, () => {
        calls += 1;
        return ok({ unread: calls });
      }),
    );
    const { result, unmount } = renderHook(() => useNotifications(), { wrapper: withStore('EMPLOYEE') });
    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() => expect(result.current.unread).toBe(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(calls).toBe(2));
    unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls).toBe(2); // cleanup cleared the interval
  });
});

describe('useFormValidation (backend-dependent duplicate email)', () => {
  it('asks the backend once per email (cached) and recognises a duplicate', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/employees`, () => {
        calls += 1;
        return page([employees[0]]);
      }),
    );
    const { result } = renderHook(() => useFormValidation(), { wrapper: withStore('SUPER_ADMIN') });
    expect(await result.current.isEmailTaken('alice.anders@ems.example')).toBe(true);
    expect(await result.current.isEmailTaken('ALICE.ANDERS@ems.example')).toBe(true); // case-insensitive + cached
    expect(calls).toBe(1);
  });
  it('treats the employee being edited as not-a-duplicate of themself', async () => {
    server.use(http.get(`${API}/employees`, () => page([employees[0]])));
    const { result } = renderHook(() => useFormValidation({ exceptEmployeeId: 4 }), {
      wrapper: withStore('SUPER_ADMIN'),
    });
    expect(await result.current.isEmailTaken('alice.anders@ems.example')).toBe(false);
  });
  it('a lookup failure never blocks the user, and malformed emails skip the request', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/employees`, () => {
        calls += 1;
        return new Response(null, { status: 500 });
      }),
    );
    const { result } = renderHook(() => useFormValidation(), { wrapper: withStore('SUPER_ADMIN') });
    expect(await result.current.isEmailTaken('not-an-email')).toBe(false);
    expect(calls).toBe(0);
    expect(await result.current.isEmailTaken('x@ems.example')).toBe(false);
  });
});

describe('useEmployees (URL ⇄ filters ⇄ RTK Query)', () => {
  it('parses filters from the URL with defaults', () => {
    const f = parseEmployeeFilters(new URLSearchParams('q=ali&departmentId=2&page=3&status=ALL'));
    expect(f).toMatchObject({ q: 'ali', departmentId: 2, page: 3, status: 'ALL', sort: 'name', limit: 10 });
    expect(parseEmployeeFilters(new URLSearchParams('')).status).toBe('ACTIVE');
  });
  it('queries the backend with the URL filters and resets to page 1 when a filter changes', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/employees`, ({ request }) => {
        urls.push(request.url);
        return page(employees, 1, 10, 3);
      }),
    );
    const store = storeFor('SUPER_ADMIN');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Wrapper store={store}>
        <MemoryRouter initialEntries={['/employees?page=4&q=a']}>{children}</MemoryRouter>
      </Wrapper>
    );
    const { result } = renderHook(() => useEmployees(), { wrapper });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(3));
    expect(new URL(urls[0]).searchParams.get('page')).toBe('4');
    act(() => result.current.update({ departmentId: 2 }));
    await waitFor(() => expect(result.current.filters).toMatchObject({ departmentId: 2, page: 1, q: 'a' }));
  });
});

describe('useDepartments / department filter', () => {
  it('builds select options from the cached list', async () => {
    server.use(http.get(`${API}/departments`, () => page(departments)));
    const { result } = renderHook(() => useDepartments(), { wrapper: withStore('SUPER_ADMIN') });
    await waitFor(() => expect(result.current.options).toHaveLength(3));
    expect(result.current.options[0]).toEqual({ value: '1', label: 'Engineering' });
    expect(result.current.nameById(3)).toBe('Sales');
    expect(result.current.nameById(99)).toBe('—');
  });
  it('the cross-screen department filter lives in Redux', () => {
    const { result } = renderHook(() => useDepartmentFilter(), { wrapper: withStore('SUPER_ADMIN') });
    expect(result.current[0]).toBeNull();
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
  });
});

describe('useOnlineStatus (useSyncExternalStore)', () => {
  it('follows the browser online/offline events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
