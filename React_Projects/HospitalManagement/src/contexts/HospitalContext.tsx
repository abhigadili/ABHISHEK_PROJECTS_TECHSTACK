import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { readJson, writeJson } from '@/utils/storage';

/** "Active hospital" the staff member is working in. Context API for cross-module, rarely-changing app state. */
interface HospitalContextValue {
  activeHospitalId: number | null;
  setActiveHospitalId: (id: number | null) => void;
}
const HospitalContext = createContext<HospitalContextValue | null>(null);
const KEY = 'hms.activeHospital';

export function HospitalProvider({ children }: { children: ReactNode }) {
  const [activeHospitalId, setId] = useState<number | null>(() => readJson<number | null>(KEY, null));
  const setActiveHospitalId = useCallback((id: number | null) => {
    setId(id);
    writeJson(KEY, id);
  }, []);
  const value = useMemo(() => ({ activeHospitalId, setActiveHospitalId }), [activeHospitalId, setActiveHospitalId]);
  return <HospitalContext value={value}>{children}</HospitalContext>;
}

export function useActiveHospital(): HospitalContextValue {
  const v = use(HospitalContext);
  if (!v) throw new Error('useActiveHospital must be used inside <HospitalProvider>');
  return v;
}
