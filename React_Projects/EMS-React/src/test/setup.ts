import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';
import { tokenStore } from '@/api/tokenStore';

// jsdom lacks these browser APIs that MUI / Recharts / the app use
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
URL.createObjectURL = vi.fn(() => 'blob:test');
URL.revokeObjectURL = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // an unmocked request is a test bug, not a silent pass
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  tokenStore.clear();
  vi.useRealTimers();
});
afterAll(() => server.close());
