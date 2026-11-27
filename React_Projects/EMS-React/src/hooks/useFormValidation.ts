import { useCallback, useMemo, useRef } from 'react';
import { employeeApi } from '@/services/employeeApi';
import { createEmployeeSchema } from '@/schemas/employee';

/**
 * Backend-dependent validation: "is this work email already used?". Results are cached per email for the life of the form so
 * React Hook Form re-validating on every blur doesn't fire a request each time. The backend (409 DUPLICATE) remains the final authority.
 */
export function useFormValidation(opts: { exceptEmployeeId?: number } = {}) {
  const cache = useRef(new Map<string, boolean>());

  const isEmailTaken = useCallback(
    async (email: string) => {
      const key = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(key)) return false; // let the sync rules report malformed addresses
      const hit = cache.current.get(key);
      if (hit !== undefined) return hit;
      try {
        const res = await employeeApi.list({ q: key, status: 'ALL', limit: 20 });
        const taken = res.items.some(
          (e) => e.workEmail.toLowerCase() === key && e.id !== opts.exceptEmployeeId,
        );
        cache.current.set(key, taken);
        return taken;
      } catch {
        return false; // a lookup failure must not block the user; the server validates on submit
      }
    },
    [opts.exceptEmployeeId],
  );

  const schema = useMemo(() => createEmployeeSchema({ isEmailTaken }), [isEmailTaken]);
  return {
    isEmailTaken,
    schema,
    forgetEmail: (email: string) => cache.current.delete(email.trim().toLowerCase()),
  };
}
