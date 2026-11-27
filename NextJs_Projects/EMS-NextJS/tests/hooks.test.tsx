// @vitest-environment jsdom
import './setup-dom';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';
import { useEmployeeSearch } from '@/hooks/useEmployees';
import { getJson, sendJson, HttpError } from '@/lib/client/fetcher';
import { loadQualifications, saveQualifications } from '@/lib/client/qualifications';

describe('useDebounce', () => {
  it('only emits after the value stops changing', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' }); rerender({ v: 'abc' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(299); }); expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(2); }); expect(result.current).toBe('abc');
  });
});

describe('useEmployeeSearch', () => {
  const hit = { id: 1, fullName: 'Ann Lee', employeeCode: 'E1', jobTitle: null, department: { name: 'Eng' } };
  it('ignores queries shorter than 2 characters (no request)', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { result } = renderHook(() => useEmployeeSearch('a'));
    await new Promise((r) => setTimeout(r, 350));
    expect(f).not.toHaveBeenCalled(); expect(result.current).toEqual({ hits: [], loading: false, error: null });
  });
  it('debounces, calls the same-origin BFF and maps results; loading is derived', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ items: [hit] }), { status: 200 })); vi.stubGlobal('fetch', f);
    const { result } = renderHook(() => useEmployeeSearch('ann'));
    await waitFor(() => expect(result.current.hits).toHaveLength(1));
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe('/api/employees?search=ann&limit=8');
    expect(result.current).toMatchObject({ loading: false, error: null, hits: [{ id: 1, fullName: 'Ann Lee', department: 'Eng' }] });
  });
  it('surfaces an error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Boom' } }), { status: 500 })));
    const { result } = renderHook(() => useEmployeeSearch('ann'));
    await waitFor(() => expect(result.current.error).toBe('Boom'));
  });
});

describe('client fetcher (BFF only; never touches tokens)', () => {
  it('getJson throws HttpError with the server message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Nope' } }), { status: 403 })));
    await expect(getJson('/api/x')).rejects.toMatchObject({ status: 403, message: 'Nope' });
    await expect(getJson('/api/x')).rejects.toBeInstanceOf(HttpError);
  });
  it('sendJson posts JSON and returns the body', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })); vi.stubGlobal('fetch', f);
    expect(await sendJson('/api/x', 'POST', { a: 1 })).toEqual({ ok: true });
    const init = (f.mock.calls[0] as unknown[])[1] as RequestInit; expect(init.method).toBe('POST'); expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('browser-only qualifications store', () => {
  it('round-trips per employee and survives corrupt storage', () => {
    saveQualifications(5, { education: [{ degree: 'BSc' }], experience: [], skills: [], certifications: [] });
    expect(loadQualifications(5).education).toEqual([{ degree: 'BSc' }]);
    expect(loadQualifications(6)).toEqual({});
    localStorage.setItem('ems.qualifications.9', '{not json'); expect(loadQualifications(9)).toEqual({});
  });
});
