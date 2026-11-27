import { describe, expect, it, vi } from 'vitest';
import { makeStore, rejectedThunkLogger } from '@/store';
import { fetchNotifications, markAllRead, markedReadLocally, selectNotifications, selectUnread, selectUnreadItems } from '@/store/notificationsSlice';
import { closeSidebar, toggleSidebar } from '@/store/uiSlice';

const n = (id: number, isRead = false) => ({ id, type: 'T', title: `t${id}`, message: 'm', refType: null, refId: null, isRead, createdAt: `2026-01-0${id}T00:00:00Z` });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe('Redux store (only for shared client UI state)', () => {
  it('every makeStore() is a NEW store — no cross-request/user leakage during SSR', () => {
    const a = makeStore(), b = makeStore();
    a.dispatch(toggleSidebar()); expect(a.getState().ui.sidebarOpen).toBe(true); expect(b.getState().ui.sidebarOpen).toBe(false);
    a.dispatch(closeSidebar()); expect(a.getState().ui.sidebarOpen).toBe(false);
  });
  it('fetchNotifications normalises into an entity adapter (newest first) and stores the unread count', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [n(1), n(3, true), n(2)], unread: 2 })));
    const s = makeStore(); await s.dispatch(fetchNotifications());
    expect(selectNotifications(s.getState()).map((x) => x.id)).toEqual([3, 2, 1]);
    expect(selectUnread(s.getState())).toBe(2); expect(selectUnreadItems(s.getState()).map((x) => x.id)).toEqual([2, 1]);
    expect(s.getState().notifications.status).toBe('ready');
  });
  it('a failed fetch sets status=failed and keeps the previous items', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 500)));
    const s = makeStore(); const r = await s.dispatch(fetchNotifications());
    expect(fetchNotifications.rejected.match(r)).toBe(true); expect(s.getState().notifications.status).toBe('failed');
  });
  it('optimistic mark-all-read flips every item and zeroes the badge before the server answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [n(1), n(2)], unread: 2 })));
    const s = makeStore(); await s.dispatch(fetchNotifications());
    s.dispatch(markedReadLocally());
    expect(selectUnread(s.getState())).toBe(0); expect(selectNotifications(s.getState()).every((x) => x.isRead)).toBe(true);
  });
  it('markAllRead posts to the BFF (never to Express) and rejects on failure', async () => {
    const f = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => json({ ok: true })); vi.stubGlobal('fetch', f);
    await makeStore().dispatch(markAllRead());
    expect(String(f.mock.calls[0]![0])).toBe('/api/notifications'); expect((f.mock.calls[0]![1] as RequestInit).method).toBe('POST');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => json({}, 500)));
    expect(markAllRead.rejected.match(await makeStore().dispatch(markAllRead()))).toBe(true);
  });
  it('custom middleware reports only the TYPE of rejected thunks (never payloads) and always forwards the action', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); const next = vi.fn((a) => a);
    const act = { type: 'x/rejected', payload: 'secret-token', meta: { requestId: 'r1', requestStatus: 'rejected' }, error: { message: 'boom' } };
    rejectedThunkLogger({} as never)(next)(act);
    expect(next).toHaveBeenCalledWith(act); expect(warn).toHaveBeenCalledWith('[redux] thunk rejected:', 'x/rejected');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
  });
});
