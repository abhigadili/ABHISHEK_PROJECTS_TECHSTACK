import DOMPurify from 'dompurify';
import { useMemo } from 'react';
/** The ONLY place rich-text HTML is rendered: always sanitised with DOMPurify (XSS prevention). */
export const sanitize = (html: string) => DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'iframe'], FORBID_ATTR: ['style', 'onerror', 'onload'] });
export function SafeHtml({ html, className }: { html?: string | null; className?: string }) {
  const clean = useMemo(() => sanitize(html ?? ''), [html]);
  if (!clean) return <span className="text-muted">—</span>;
  return <div className={`rich-html ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
