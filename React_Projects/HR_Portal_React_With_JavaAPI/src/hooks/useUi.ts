import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n';
/** Returns a translator for literal English phrases; re-renders the caller when the language changes. */
export function useUi() { const { i18n } = useTranslation(); return useCallback((s: string) => tr(s), [i18n.resolvedLanguage]); } // eslint-disable-line react-hooks/exhaustive-deps
export const trNode = <T,>(n: T): T | string => (typeof n === 'string' ? tr(n) : n);
