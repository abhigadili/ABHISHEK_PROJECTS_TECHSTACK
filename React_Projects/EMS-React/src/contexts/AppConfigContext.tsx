import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { env } from '@/constants/env';

export interface AppConfig {
  appName: string;
  apiBaseUrl: string;
  pageSizeOptions: number[];
  defaultPageSize: number;
  notificationPollMs: number;
}

const defaults: AppConfig = {
  appName: env.appName,
  apiBaseUrl: env.apiBaseUrl,
  pageSizeOptions: [5, 10, 25, 50],
  defaultPageSize: env.defaultPageSize,
  notificationPollMs: env.notificationPollMs,
};
const AppConfigContext = createContext<AppConfig>(defaults);

/** Static, read-only configuration: the textbook "Context is enough" case — it never changes, so there is no re-render cost. */
export function AppConfigProvider({
  children,
  overrides,
}: {
  children: ReactNode;
  overrides?: Partial<AppConfig>;
}) {
  const value = useMemo(() => ({ ...defaults, ...overrides }), [overrides]);
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}
export const useAppConfig = () => useContext(AppConfigContext);
