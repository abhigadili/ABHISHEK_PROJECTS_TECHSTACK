import { createContext, useContext, type ReactNode } from 'react';
import { config } from '@/app/config/env';
const Ctx = createContext(config);
export const useAppConfig = () => useContext(Ctx);
export const ConfigProvider = ({ children }: { children: ReactNode }) => <Ctx.Provider value={config}>{children}</Ctx.Provider>;
