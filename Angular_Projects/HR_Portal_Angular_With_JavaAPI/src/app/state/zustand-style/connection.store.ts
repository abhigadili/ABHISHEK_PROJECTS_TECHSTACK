import { createStore } from './create-store';
/** Backend reachability (drives the "HR API is unreachable" banner). Not persisted. */
export const connectionStore = createStore({ online: true, message: '' as string });
export const setOnline = (online: boolean, message = '') => { if (connectionStore.get().online !== online) connectionStore.set({ online, message }); };
