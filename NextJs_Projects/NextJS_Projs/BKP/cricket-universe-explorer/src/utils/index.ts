/**
 * ============================================================
 * Cricket Universe Explorer — Utility / Helper Functions
 * ============================================================
 *
 * Why a separate utils file?
 *   Business logic (lookups, formatting, filtering) belongs
 *   here, NOT inside React components.  Keeping logic in
 *   pure functions makes it:
 *     • Testable in isolation (no DOM, no React needed)
 *     • Re-usable across Server Components, Client Components,
 *       and API Route Handlers
 *     • Easy to read — components stay small and declarative
 *
 * Interview tip: Pure functions (same input → same output,
 *   no side-effects) are the easiest code to test. Every
 *   function in this file is pure — great candidates for
 *   unit tests with Vitest or Jest.
 *
 * Next.js best practice: Import these utilities with a plain
 *   `import` (not dynamic import) because they're tiny,
 *   synchronous, and needed on first render.  Reserve
 *   `dynamic` / lazy loading for heavy third-party libraries.
 * ============================================================
 */

import type { Country, Cricketer, League, Team } from '@/types';
import { countries } from '@/data/countries';
import { cricketers } from '@/data/cricketers';
import { leagues } from '@/data/leagues';
import { teams } from '@/data/teams';

// ─────────────────────────────────────────────
// Number formatting
// ─────────────────────────────────────────────

/**
 * Formats a number with thousands separators.
 *
 * Examples:
 *   formatNumber(1234)    → '1,234'
 *   formatNumber(7263)    → '7,263'
 *   formatNumber(100)     → '100'
 *   formatNumber(1000000) → '1,000,000'
 *
 * Interview tip: `Intl.NumberFormat` is the browser/Node built-in
 *   for locale-aware number formatting — prefer it over manual
 *   regex/replace chains because it handles edge cases (negative
 *   numbers, decimals, different locales) automatically.
 *
 * Why 'en-US'?  The comma-as-thousands-separator style is most
 *   common in cricket statistics internationally.  You could
 *   accept a locale parameter to make this more flexible.
 *
 * @param value  - The integer or float to format
 * @returns      Formatted string with thousands separators
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

// ─────────────────────────────────────────────
// Text utilities
// ─────────────────────────────────────────────

/**
 * Truncates a string to `maxLength` characters, appending '…'
 * if the string was longer than the limit.
 *
 * Used for card descriptions, meta tags, and preview text.
 *
 * Examples:
 *   truncateText('Hello world', 5) → 'Hello…'
 *   truncateText('Hi', 10)         → 'Hi'
 *
 * Interview tip: Always append the ellipsis AFTER slicing, not
 *   before — slice(0, maxLength) already removes the tail.
 *   The result length will be maxLength + 1 (for '…'), which is
 *   acceptable for UI display purposes.
 *
 * @param text      - Source string
 * @param maxLength - Maximum number of characters to keep
 * @returns         Truncated string, or original if short enough
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

// ─────────────────────────────────────────────
// Country lookups
// ─────────────────────────────────────────────

/**
 * Returns a single Country by id, or undefined if not found.
 *
 * Why return `Country | undefined` instead of throwing?
 *   Throwing for a missing entity is an anti-pattern in
 *   data-lookup utilities — the caller decides how to handle
 *   "not found" (show 404, show placeholder, skip render, etc.).
 *
 * Interview tip: `Array.prototype.find()` returns `T | undefined`.
 *   Callers should use optional chaining (`country?.name`) or a
 *   nullish-coalescing fallback (`country ?? defaultCountry`).
 *
 * @param id - The country id, e.g. 'ind', 'aus'
 * @returns  The matching Country, or undefined
 */
export function getCountryById(id: string): Country | undefined {
  // Why: O(n) linear scan is fine for 6 countries; would use a
  //   Map<id, Country> for hundreds of records.
  return countries.find((c) => c.id === id);
}

/**
 * Returns all countries.  Useful for list pages and static
 * params generation in `generateStaticParams()`.
 *
 * Next.js best practice: Call this in generateStaticParams() so
 *   Next.js pre-renders all /countries/[id] pages at build time:
 *
 *   export function generateStaticParams() {
 *     return getAllCountries().map(c => ({ id: c.id }));
 *   }
 */
export function getAllCountries(): Country[] {
  return countries;
}

// ─────────────────────────────────────────────
// League lookups
// ─────────────────────────────────────────────

/**
 * Returns a single League by id, or undefined if not found.
 *
 * @param id - The league id, e.g. 'ipl', 'bbl', 'psl'
 */
export function getLeagueById(id: string): League | undefined {
  return leagues.find((l) => l.id === id);
}

/**
 * Returns all leagues for a given country.
 *
 * This is the equivalent of the SQL query:
 *   SELECT * FROM leagues WHERE country_id = ?
 *
 * Interview tip: `Array.filter()` is the pure-function equivalent
 *   of a WHERE clause.  For large datasets, create an index:
 *   Map<countryId, League[]> built once at module load time.
 *
 * @param countryId - The parent country id, e.g. 'ind'
 * @returns         Array of leagues (may be empty)
 */
export function getLeaguesByCountry(countryId: string): League[] {
  return leagues.filter((l) => l.countryId === countryId);
}

/**
 * Returns all leagues.  Useful for sitemap generation and
 * global listing pages.
 */
export function getAllLeagues(): League[] {
  return leagues;
}

// ─────────────────────────────────────────────
// Team lookups
// ─────────────────────────────────────────────

/**
 * Returns a single Team by id, or undefined if not found.
 *
 * @param id - The team id, e.g. 'csk', 'mi', 'rcb'
 */
export function getTeamById(id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

/**
 * Returns all teams that compete in the given league.
 *
 * Equivalent SQL:
 *   SELECT * FROM teams WHERE league_id = ?
 *
 * @param leagueId - The parent league id, e.g. 'ipl', 'psl'
 * @returns        Array of teams (may be empty)
 */
export function getTeamsByLeague(leagueId: string): Team[] {
  return teams.filter((t) => t.leagueId === leagueId);
}

/**
 * Returns all teams.
 */
export function getAllTeams(): Team[] {
  return teams;
}

// ─────────────────────────────────────────────
// Cricketer lookups
// ─────────────────────────────────────────────

/**
 * Returns a single Cricketer by id, or undefined if not found.
 *
 * @param id - The cricketer id, e.g. 'ms-dhoni-csk'
 */
export function getCricketerById(id: string): Cricketer | undefined {
  return cricketers.find((p) => p.id === id);
}

/**
 * Returns all cricketers who play for the given team.
 *
 * Equivalent SQL:
 *   SELECT * FROM cricketers WHERE team_id = ?
 *
 * Interview tip: When building a player profile page that
 *   also shows teammates, call getCricketersByTeam(teamId)
 *   and filter out the current player: `.filter(p => p.id !== id)`.
 *
 * @param teamId - The parent team id, e.g. 'csk'
 * @returns      Array of cricketers (may be empty)
 */
export function getCricketersByTeam(teamId: string): Cricketer[] {
  return cricketers.filter((p) => p.teamId === teamId);
}

/**
 * Returns all cricketers.
 */
export function getAllCricketers(): Cricketer[] {
  return cricketers;
}

// ─────────────────────────────────────────────
// Cross-entity / aggregation helpers
// ─────────────────────────────────────────────

/**
 * Returns all cricketers from every team in the given league.
 *
 * This simulates a two-level JOIN:
 *   teams WHERE leagueId = X  →  cricketers WHERE teamId IN (...)
 *
 * Interview tip: Instead of a nested loop (O(n²)), we build a
 *   Set of teamIds first for O(1) lookups in the cricketers filter.
 *   This is the kind of optimisation interviewers look for when
 *   asked "how would you improve this?"
 *
 * @param leagueId - The league id, e.g. 'ipl'
 * @returns        All cricketers who belong to a team in that league
 */
export function getCricketersByLeague(leagueId: string): Cricketer[] {
  // Build a Set of team IDs for fast lookup — O(n) not O(n²)
  const teamIdsInLeague = new Set(
    teams.filter((t) => t.leagueId === leagueId).map((t) => t.id)
  );
  return cricketers.filter((p) => teamIdsInLeague.has(p.teamId));
}

/**
 * Returns cricketers sorted by runs (descending) — an IPL
 * Orange Cap leaderboard equivalent.
 *
 * Interview tip: `Array.sort()` mutates in place.  We spread
 *   into a new array first ([...cricketers]) so the original
 *   export is never modified — this preserves referential
 *   integrity for other callers.
 *
 * @param limit - Optional max number of results (default: all)
 */
export function getTopRunScorers(limit?: number): Cricketer[] {
  const sorted = [...cricketers].sort((a, b) => b.runs - a.runs);
  return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

/**
 * Returns cricketers sorted by wickets (descending) — a Purple
 * Cap leaderboard equivalent.
 *
 * @param limit - Optional max number of results (default: all)
 */
export function getTopWicketTakers(limit?: number): Cricketer[] {
  const sorted = [...cricketers].sort((a, b) => b.wickets - a.wickets);
  return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

/**
 * Simple full-text search across cricketers by name or country.
 *
 * Case-insensitive substring match — not a fuzzy search.
 * In production you'd use a search engine (Algolia, Typesense)
 * or database full-text search for this feature.
 *
 * @param query - Search term, e.g. 'India', 'Kohli'
 * @returns     Matching cricketers
 */
export function searchCricketers(query: string): Cricketer[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return cricketers.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q)
  );
}
