/**
 * ============================================================
 * Cricket Universe Explorer — Application Constants
 * ============================================================
 *
 * Why a constants file?
 *   Magic strings scattered across components are brittle.
 *   Centralising them means a single change propagates everywhere.
 *
 * Interview tip: `as const` (const assertion) narrows the type
 *   of an object's values from `string` to their exact literal
 *   type, e.g. `ROUTES.HOME` becomes type `'/'` not `string`.
 *   This enables exhaustive switch-case checking and better
 *   IntelliSense autocomplete.
 *
 * Next.js best practice: Use ROUTES constants instead of
 *   hard-coded path strings in <Link href="..."> and
 *   router.push() calls — you'll catch broken links at
 *   compile time rather than at runtime.
 * ============================================================
 */

import type { CricketFormat } from '@/types';

// ─────────────────────────────────────────────
// App identity
// ─────────────────────────────────────────────

/** Displayed in the <title> tag, navbar, and metadata */
export const APP_NAME = 'Cricket Universe Explorer' as const;

/** Short tagline used in og:description and hero sections */
export const APP_TAGLINE =
  'Explore countries, leagues, teams, and cricketers from around the world.' as const;

// ─────────────────────────────────────────────
// API base URL
// ─────────────────────────────────────────────

/**
 * Base URL for all internal API route calls.
 *
 * Why process.env.NEXT_PUBLIC_API_URL with a fallback?
 *   - In production, set NEXT_PUBLIC_API_URL to your deployed
 *     domain (e.g. https://cricket-universe.vercel.app).
 *   - In local dev it falls back to http://localhost:3000.
 *
 * Interview tip: NEXT_PUBLIC_ prefix is required for env vars
 *   that need to be accessible in client-side (browser) code.
 *   Vars without the prefix are only available server-side.
 *
 * Next.js best practice: Never hard-code 'localhost:3000' —
 *   always use an env var with a sensible fallback.
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ─────────────────────────────────────────────
// Cricket formats
// ─────────────────────────────────────────────

/**
 * Array of all cricket formats.  Used to populate <select>
 * dropdowns and filter chips without duplicating the literals.
 *
 * Interview tip: We derive this from the CricketFormat union
 *   type via `satisfies` so TypeScript ensures every element
 *   is a valid CricketFormat — adding a typo would be a
 *   compile error.
 */
export const CRICKET_FORMATS: CricketFormat[] = [
  'Test',
  'ODI',
  'T20',
  'First-Class',
  'List-A',
] satisfies CricketFormat[];

// ─────────────────────────────────────────────
// Pagination defaults
// ─────────────────────────────────────────────

/** Default page size for list pages */
export const DEFAULT_PAGE_SIZE = 20 as const;

/** Maximum allowed page size to prevent abuse */
export const MAX_PAGE_SIZE = 100 as const;

// ─────────────────────────────────────────────
// Client-side route constants
// ─────────────────────────────────────────────

/**
 * All navigable routes in the application.
 *
 * Dynamic segments use a function so callers write:
 *   ROUTES.COUNTRY('ind')   →  '/countries/ind'
 * instead of template literals spread across the codebase.
 *
 * Interview tip: Colocating route builders here means a URL
 *   structure change only touches ONE file, not dozens of
 *   components.
 *
 * Next.js best practice: Use these with Next.js <Link> and
 *   the `useRouter` hook — never bare anchor tags — so
 *   prefetching and client-side transitions work correctly.
 */
export const ROUTES = {
  // ── Static routes ──────────────────────────
  HOME: '/',
  COUNTRIES: '/countries',
  LEAGUES: '/leagues',
  TEAMS: '/teams',
  CRICKETERS: '/cricketers',
  SEARCH: '/search',
  ABOUT: '/about',

  // ── Dynamic route builders ─────────────────
  /** /countries/[id] */
  COUNTRY: (id: string) => `/countries/${id}` as const,

  /** /leagues/[id] */
  LEAGUE: (id: string) => `/leagues/${id}` as const,

  /** /teams/[id] */
  TEAM: (id: string) => `/teams/${id}` as const,

  /** /cricketers/[id] */
  CRICKETER: (id: string) => `/cricketers/${id}` as const,

  // ── Filtered list routes ───────────────────
  /** /leagues?country=[countryId] */
  LEAGUES_BY_COUNTRY: (countryId: string) =>
    `/leagues?country=${countryId}` as const,

  /** /teams?league=[leagueId] */
  TEAMS_BY_LEAGUE: (leagueId: string) =>
    `/teams?league=${leagueId}` as const,

  /** /cricketers?team=[teamId] */
  CRICKETERS_BY_TEAM: (teamId: string) =>
    `/cricketers?team=${teamId}` as const,

  // ── API route prefixes ─────────────────────
  API: {
    COUNTRIES: '/api/countries',
    COUNTRY: (id: string) => `/api/countries/${id}` as const,
    LEAGUES: '/api/leagues',
    LEAGUE: (id: string) => `/api/leagues/${id}` as const,
    LEAGUES_BY_COUNTRY: (countryId: string) =>
      `/api/leagues?countryId=${countryId}` as const,
    TEAMS: '/api/teams',
    TEAM: (id: string) => `/api/teams/${id}` as const,
    TEAMS_BY_LEAGUE: (leagueId: string) =>
      `/api/teams?leagueId=${leagueId}` as const,
    CRICKETERS: '/api/cricketers',
    CRICKETER: (id: string) => `/api/cricketers/${id}` as const,
    CRICKETERS_BY_TEAM: (teamId: string) =>
      `/api/cricketers?teamId=${teamId}` as const,
  },
} as const;

// ─────────────────────────────────────────────
// Metadata / SEO defaults
// ─────────────────────────────────────────────

/**
 * Used in Next.js generateMetadata() as fallback values.
 *
 * Next.js best practice: Export these so every page's
 *   `generateMetadata` can spread them and override only
 *   the fields it needs.
 */
export const DEFAULT_METADATA = {
  title: APP_NAME,
  description: APP_TAGLINE,
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
  },
} as const;

// ─────────────────────────────────────────────
// UI / styling constants
// ─────────────────────────────────────────────

/**
 * Reusable Tailwind class combinations.
 * Keeps the design system consistent without a component library.
 *
 * Interview tip: Storing class strings as constants (rather than
 *   duplicating them) ensures a colour-scheme change is a
 *   one-line edit.
 */
export const UI = {
  /** Card container */
  CARD: 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:bg-white/10 transition-all',
  /** Primary button */
  BTN_PRIMARY:
    'inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors',
  /** Section heading */
  SECTION_HEADING: 'text-2xl font-bold text-white mb-4',
} as const;
