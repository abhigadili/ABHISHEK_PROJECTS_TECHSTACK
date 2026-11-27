import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage, isAbortError } from '@/services/axios/errors';
import { saveBlob } from '@/utils/download';
import { withRetry } from '@/utils/promise';

/**
 * Wraps an async "give me a blob" function with busy state, toast feedback, ONE retry for network/5xx failures
 * (withRetry) and cancellation: every download gets its own AbortController, `cancel(key)` aborts the request in flight.
 * The loader receives the AbortSignal (loaders that cannot be aborted may ignore it).
 */
export function useFileDownload() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());

  const download = useCallback(async (key: string, load: (signal: AbortSignal) => Promise<{ blob: Blob; fileName: string }>) => {
    const ac = new AbortController();
    controllers.current.set(key, ac);
    setBusyKey(key);
    try {
      const { blob, fileName } = await withRetry(() => load(ac.signal), { retries: 1 });
      if (ac.signal.aborted) return;
      saveBlob(blob, fileName);
      toast.success(`Downloaded ${fileName}`);
    } catch (e) {
      if (ac.signal.aborted || isAbortError(e)) toast('Download cancelled');
      else toast.error(errorMessage(e));
    } finally {
      controllers.current.delete(key);
      setBusyKey(null);
    }
  }, []);

  const cancel = useCallback((key: string) => controllers.current.get(key)?.abort(), []);
  return { download, cancel, busyKey, isBusy: (key: string) => busyKey === key };
}
