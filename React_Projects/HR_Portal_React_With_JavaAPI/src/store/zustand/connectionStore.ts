import { create } from 'zustand';
/** Backend reachability, set by the Axios interceptors; drives the global "API unavailable" banner. */
interface S { online: boolean; message?: string; setOnline: (v: boolean, m?: string) => void }
export const useConnectionStore = create<S>((set) => ({
  online: true,
  setOnline: (online, message) => set((s) => (s.online === online && s.message === message ? s : { online, message })),
}));
