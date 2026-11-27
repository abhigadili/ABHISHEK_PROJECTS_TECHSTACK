'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface AppConfig { appName: string; pageSizes: number[]; defaultPageSize: number }
const Ctx = createContext<AppConfig | null>(null);

/** Static, public configuration (slow-changing → Context is enough). Never put secrets here: this ships to the browser. */
export function ConfigProvider({ appName, children }: { appName: string; children: ReactNode }) {
  const value = useMemo(() => ({ appName, pageSizes: [10, 25, 50], defaultPageSize: 10 }), [appName]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useConfig(): AppConfig {
  const c = useContext(Ctx);
  if (!c) throw new Error('useConfig must be used inside <ConfigProvider>');
  return c;
}
