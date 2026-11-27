import { lazy, Suspense, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { sanitize } from './SafeHtml';
const JoditEditor = lazy(() => import('jodit-react'));

/** Jodit rich-text editor (lazy-loaded). Output is sanitised before it leaves the component. */
export function RichTextEditor({ value, onChange, placeholder, height = 220 }: { value?: string; onChange: (html: string) => void; placeholder?: string; height?: number }) {
  const cfg = useMemo(() => ({
    readonly: false, height, placeholder: placeholder ?? '', toolbarAdaptive: true, askBeforePasteHTML: false, askBeforePasteFromWord: false, defaultActionOnPaste: 'insert_clear_html' as const,
    buttons: 'bold,italic,underline,|,ul,ol,|,link,|,undo,redo,|,eraser',
    showCharsCounter: false, showWordsCounter: false, showXPathInStatusbar: false, disablePlugins: 'about,powered-by-jodit',
  }), [height, placeholder]);
  return (
    <Suspense fallback={<Skeleton className="h-[220px]" />}>
      <JoditEditor value={value ?? ''} config={cfg as any} onBlur={(h: string) => onChange(sanitize(h))} />
    </Suspense>
  );
}
