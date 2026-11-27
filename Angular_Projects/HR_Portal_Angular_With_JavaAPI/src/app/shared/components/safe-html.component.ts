import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import DOMPurify from 'dompurify';

/** The ONLY place user-authored HTML is rendered: sanitised with DOMPurify (scripts, event handlers, javascript: URLs removed), links forced to rel=noopener. */
export const sanitizeHtml = (html: string | null | undefined) => DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'iframe'], FORBID_ATTR: ['style'], ADD_ATTR: ['target'] });
DOMPurify.addHook('afterSanitizeAttributes', (n) => { if (n.tagName === 'A') { n.setAttribute('rel', 'noopener noreferrer'); n.setAttribute('target', '_blank'); } });

@Component({
  selector: 'app-safe-html', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rich-html" [innerHTML]="clean()"></div>`,
})
export class SafeHtmlComponent { html = input<string | null | undefined>(''); clean = computed(() => sanitizeHtml(this.html())); }
