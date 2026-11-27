import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import manifest from '@/app/manifest';
import { DOCS, HELP, findArticle } from '@/content/articles';

describe('robots.txt', () => {
  const r = robots();
  const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules)!;
  const disallow = ([] as string[]).concat(rule.disallow ?? []);
  it('keeps crawlers out of every authenticated area and the API', () => {
    for (const p of ['/api/', '/dashboard', '/employees', '/departments', '/attendance', '/leaves', '/reports', '/users', '/profile', '/login', '/register']) expect(disallow).toContain(p);
  });
  it('allows the public pages and advertises the sitemap', () => {
    expect(([] as string[]).concat(rule.allow ?? [])).toEqual(expect.arrayContaining(['/', '/help', '/docs']));
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe('sitemap.xml', () => {
  const urls = sitemap().map((e) => new URL(e.url).pathname);
  it('lists only public pages and every article', () => {
    expect(urls).toContain('/'); expect(urls).toContain('/help');
    for (const a of DOCS) expect(urls).toContain(`/docs/${a.slug.join('/')}`);
    for (const a of HELP) expect(urls).toContain(`/help/${a.slug.join('/')}`);
    expect(urls.filter((u) => /^\/(employees|dashboard|leaves|users|profile|api)/.test(u))).toEqual([]);
  });
  it('has no duplicates', () => { expect(new Set(urls).size).toBe(urls.length); });
});

describe('content + manifest', () => {
  it('findArticle matches whole slugs only', () => { expect(findArticle(DOCS, ['privacy'])?.title).toBeTruthy(); expect(findArticle(DOCS, ['priv'])).toBeUndefined(); });
  it('article slugs are unique and URL-safe', () => {
    for (const list of [DOCS, HELP]) { const keys = list.map((a) => a.slug.join('/')); expect(new Set(keys).size).toBe(keys.length); for (const k of keys) expect(k).toMatch(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/); }
  });
  it('manifest starts the installed app at the dashboard', () => { expect(manifest().start_url).toBe('/dashboard'); });
});
