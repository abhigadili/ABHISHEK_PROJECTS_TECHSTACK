/**
 * ============================================================
 * Cricket Universe Explorer — Client-side API Layer
 * ============================================================
 *
 * PURPOSE
 * -------
 * This module provides async functions that Client Components
 * use to fetch data from the Next.js Route Handlers (API routes
 * under /app/api/).
 *
 * WHEN TO USE THIS FILE vs SERVER COMPONENTS
 * -------------------------------------------
 * ┌─────────────────────────────────┬────────────────────────────────────┐
 * │ USE THIS FILE (fetch via HTTP)  │ USE SERVER COMPONENT (direct import)│
 * ├─────────────────────────────────┼────────────────────────────────────┤
 * │ Client Components ('use client')│ Server Components (default)        │
 * │ useEffect() data fetching       │ Page / Layout components           │
 * │ React Query / SWR hooks         │ generateStaticParams()             │
 * │ Third-party API calls           │ generateMetadata()                 │
 * │ Mutations (POST/PUT/DELETE)     │ When you need zero network hop     │
 * └─────────────────────────────────┴────────────────────────────────────┘
 *
 * Next.js best practice: Server Components can import data files
 *   directly (e.g., `import { countries } from '@/data/countries'`)
 *   — no network hop, no serialisation overhead, no loading state.
 *   Only use fetch() / this API layer when you truly need to call
 *   an HTTP endpoint.
 *
 * Interview tip: Next.js extends `fetch` with caching options:
 *   • `{ cache: 'force-cache' }` — cache indefinitely (static)
 *   • `{ next: { revalidate: 60 } }` — ISR: revalidate every 60s
 *   • `{ cache: 'no-store' }` — always fresh (dynamic)
 *   The default in Next.js 15 is `no-store` unless opted-in.
 *
 * ERROR HANDLING STRATEGY
 * -----------------------
 * Each function catches network errors and API error responses
 * and re-throws a typed Error so callers can display meaningful
 * messages (error boundaries, toast notifications, etc.).
 *
 * Interview tip: Never swallow errors silently.  Even in a demo,
 *   explicit error propagation shows good engineering habits.
 * ============================================================
 */

import type {
  ApiResponse,
  Country,
  Cricketer,
  League,
  Team,
} from '@/types';
import { API_BASE_URL, ROUTES } from '@/constants';

// ─────────────────────────────────────────────
// Internal fetch helper
// ─────────────────────────────────────────────

/**
 * Thin wrapper around the browser/Node `fetch` API that:
 *   1. Prepends the API_BASE_URL so callers pass relative paths.
 *   2. Parses the JSON response as ApiResponse<T>.
 *   3. Throws an Error if the HTTP status is not OK (4xx / 5xx)
 *      or if the API returns `success: false`.
 *
 * Why a private helper?
 *   DRY — every public function below needs the same
 *   try/catch + JSON parse + status check logic.
 *
 * Interview tip: Generic functions like `apiFetch<T>` let the
 *   TypeScript compiler infer the return type at each call site,
 *   so `apiFetch<Country[]>('/api/countries')` returns
 *   `Promise<Country[]>` — fully typed with zero `any`.
 *
 * @param path  - Relative API path, e.g. '/api/countries'
 * @param init  - Optional RequestInit (method, headers, body, cache)
 * @returns     The `data` field of the ApiResponse<T>
 */
async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      // Next.js best practice: default to no-store for dynamic
      // data; override per call-site when caching is appropriate.
      cache: 'no-store',
      ...init,
    });
  } catch (networkError) {
    // This branch fires when the server is unreachable (offline,
    // CORS block, DNS failure).  Re-throw with a user-friendly msg.
    throw new Error(
      `Network error — could not reach ${url}. Check your connection.`,
      { cause: networkError }
    );
  }

  if (!response.ok) {
    // HTTP 4xx / 5xx — e.g. 404 Not Found, 500 Internal Server Error
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} (${url})`
    );
  }

  // Interview tip: We cast to ApiResponse<T> here — TypeScript
  //   cannot verify JSON shapes at runtime, so in production you'd
  //   add runtime validation with Zod: ApiResponseSchema.parse(json).
  const json: ApiResponse<T> = await response.json() as ApiResponse<T>;

  if (!json.success) {
    throw new Error(
      json.message ?? `API returned success: false for ${url}`
    );
  }

  return json.data;
}

// ─────────────────────────────────────────────
// Countries
// ─────────────────────────────────────────────

/**
 * Fetches all cricket-playing countries.
 *
 * Use this in Client Components that render the country list
 * page when you want the data refreshed on each navigation
 * (e.g., inside a useEffect or a React Query useQuery hook).
 *
 * Server Component alternative (preferred for static pages):
 *   import { countries } from '@/data/countries';
 *
 * @returns Promise resolving to a Country array
 */
export async function fetchCountries(): Promise<Country[]> {
  return apiFetch<Country[]>(ROUTES.API.COUNTRIES);
}

/**
 * Fetches a single country by its id.
 *
 * Next.js best practice: In a Server Component page, prefer
 *   `getCountryById(params.id)` from @/utils — it skips the
 *   network round-trip entirely.
 *
 * @param id - Country id, e.g. 'ind'
 * @returns  Promise resolving to a Country
 * @throws   Error if country is not found (404) or network fails
 */
export async function fetchCountry(id: string): Promise<Country> {
  return apiFetch<Country>(ROUTES.API.COUNTRY(id));
}

// ─────────────────────────────────────────────
// Leagues
// ─────────────────────────────────────────────

/**
 * Fetches all leagues across all countries.
 *
 * @returns Promise resolving to a League array
 */
export async function fetchLeagues(): Promise<League[]> {
  return apiFetch<League[]>(ROUTES.API.LEAGUES);
}

/**
 * Fetches all leagues for a specific country.
 *
 * Sends: GET /api/leagues?countryId=<countryId>
 *
 * Interview tip: Filtering on the server (query param) is more
 *   efficient than fetching all leagues and filtering client-side
 *   — the server only sends the subset you need, reducing payload
 *   size and client processing time.
 *
 * @param countryId - Parent country id, e.g. 'ind'
 * @returns         Promise resolving to a League array
 */
export async function fetchLeaguesByCountry(
  countryId: string
): Promise<League[]> {
  return apiFetch<League[]>(ROUTES.API.LEAGUES_BY_COUNTRY(countryId));
}

/**
 * Fetches a single league by its id.
 *
 * @param id - League id, e.g. 'ipl', 'psl'
 * @returns  Promise resolving to a League
 */
export async function fetchLeague(id: string): Promise<League> {
  return apiFetch<League>(ROUTES.API.LEAGUE(id));
}

// ─────────────────────────────────────────────
// Teams
// ─────────────────────────────────────────────

/**
 * Fetches all teams across all leagues.
 *
 * @returns Promise resolving to a Team array
 */
export async function fetchTeams(): Promise<Team[]> {
  return apiFetch<Team[]>(ROUTES.API.TEAMS);
}

/**
 * Fetches all teams that compete in the given league.
 *
 * Sends: GET /api/teams?leagueId=<leagueId>
 *
 * @param leagueId - Parent league id, e.g. 'ipl'
 * @returns        Promise resolving to a Team array
 */
export async function fetchTeamsByLeague(
  leagueId: string
): Promise<Team[]> {
  return apiFetch<Team[]>(ROUTES.API.TEAMS_BY_LEAGUE(leagueId));
}

/**
 * Fetches a single team by its id.
 *
 * @param id - Team id, e.g. 'csk', 'mi'
 * @returns  Promise resolving to a Team
 */
export async function fetchTeam(id: string): Promise<Team> {
  return apiFetch<Team>(ROUTES.API.TEAM(id));
}

// ─────────────────────────────────────────────
// Cricketers
// ─────────────────────────────────────────────

/**
 * Fetches all cricketers across all teams.
 *
 * Note: This returns a large payload (50+ players).
 *   In production, add pagination:
 *   GET /api/cricketers?page=1&limit=20
 *
 * @returns Promise resolving to a Cricketer array
 */
export async function fetchCricketers(): Promise<Cricketer[]> {
  return apiFetch<Cricketer[]>(ROUTES.API.CRICKETERS);
}

/**
 * Fetches all cricketers who play for the given team.
 *
 * Sends: GET /api/cricketers?teamId=<teamId>
 *
 * Next.js best practice: Pair this with React Query for
 *   optimistic caching and background refetch:
 *
 *   const { data } = useQuery({
 *     queryKey: ['cricketers', teamId],
 *     queryFn: () => fetchCricketersByTeam(teamId),
 *   });
 *
 * @param teamId - Parent team id, e.g. 'csk'
 * @returns      Promise resolving to a Cricketer array
 */
export async function fetchCricketersByTeam(
  teamId: string
): Promise<Cricketer[]> {
  return apiFetch<Cricketer[]>(ROUTES.API.CRICKETERS_BY_TEAM(teamId));
}

/**
 * Fetches a single cricketer by their id.
 *
 * @param id - Cricketer id, e.g. 'ms-dhoni-csk'
 * @returns  Promise resolving to a Cricketer
 */
export async function fetchCricketer(id: string): Promise<Cricketer> {
  return apiFetch<Cricketer>(ROUTES.API.CRICKETER(id));
}
