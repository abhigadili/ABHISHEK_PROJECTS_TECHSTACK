import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthUser } from './types';

export interface RequestContext {
  correlationId: string;
  user?: AuthUser;
  authorization?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },
  user(): AuthUser | undefined {
    return storage.getStore()?.user;
  },
  setUser(user: AuthUser): void {
    const s = storage.getStore();
    if (s) s.user = user;
  },
};
