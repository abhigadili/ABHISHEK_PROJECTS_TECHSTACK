import * as T from '@radix-ui/react-toast';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { toastRemoved } from '@/store/uiSlice';
const icon = { success: <CheckCircle2 className="text-emerald-600" size={20} />, error: <XCircle className="text-red-600" size={20} />, info: <Info className="text-sky-600" size={20} /> };
export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts); const dispatch = useAppDispatch();
  return (
    <T.Provider swipeDirection="right" duration={5000}>
      {toasts.map((t) => (
        <T.Root key={t.id} onOpenChange={(o) => !o && dispatch(toastRemoved(t.id))} role={t.kind === 'error' ? 'alert' : 'status'} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:bg-slate-900 dark:border-slate-700">
          {icon[t.kind]}
          <div className="min-w-0"><T.Title className="text-sm font-semibold">{t.title}</T.Title>{t.message && <T.Description className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{t.message}</T.Description>}</div>
        </T.Root>
      ))}
      <T.Viewport className="fixed bottom-4 right-4 z-[100] flex w-96 max-w-[92vw] flex-col gap-2 outline-none" />
    </T.Provider>
  );
}
