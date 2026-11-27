/** Tiny pub/sub that lets the (React-agnostic) HTTP layer tell the React tree about auth problems. */
type Listener = () => void;

function createChannel() {
  const listeners = new Set<Listener>();
  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    emit() {
      listeners.forEach((l) => l());
    },
  };
}

/** Refresh failed / token rejected: the session is over. */
export const sessionExpiredChannel = createChannel();
/** A request was rejected with 403. */
export const forbiddenChannel = createChannel();
