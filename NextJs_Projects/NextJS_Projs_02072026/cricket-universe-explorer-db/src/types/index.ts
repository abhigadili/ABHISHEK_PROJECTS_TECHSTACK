/**
 * ============================================================
 * Cricket Universe Explorer — Core TypeScript Interfaces
 * ============================================================
 *
 * Why a central types file?
 *   A single barrel export (`src/types/index.ts`) lets any file
 *   import with `import type { Country, League } from '@/types'`
 *   instead of reaching deep into the tree.  This is a common
 *   Next.js / large-scale TS pattern.
 *
 * Interview tip: TypeScript interfaces describe the *shape* of
 *   data — they're erased at runtime and only exist during
 *   compilation.  Use `interface` for extensible object shapes
 *   and `type` for unions, intersections, or mapped types.
 *
 * Next.js best practice: Keep data-shapes in `src/types/` and
 *   import them with the `import type` keyword when you only
 *   need the type (tree-shakes cleaner, avoids circular deps).
 * ============================================================
 */

// ─────────────────────────────────────────────
// Country
// ─────────────────────────────────────────────

/**
 * Represents a cricket-playing nation.
 *
 * Why `famousPlayers: string[]` instead of `Cricketer[]`?
 *   Circular references (Country → Cricketer → Country) cause
 *   complex dependency graphs. Storing names as strings here
 *   keeps the type simple and avoids import cycles.
 *
 * Interview tip: Prefer composition and avoid deeply nested
 *   entity references in data models. Resolve them at the
 *   service/utility layer instead.
 */
export interface Country {
  /** Unique short identifier, e.g. 'ind', 'aus' */
  id: string;
  /** Full country name, e.g. 'India' */
  name: string;
  /** Three-letter abbreviation used in scoreboards */
  shortName: string;
  /** Emoji or URL of the national flag */
  flag: string;
  /** Multi-sentence background description */
  description: string;
  /** Hero/banner image URL used on the detail page */
  background: string;
  /** Year the national cricket board was established */
  established: number;
  /** Total ICC Cricket World Cup (50-over) wins */
  worldCupsWon: number;
  /** Cricket governing board name, e.g. 'BCCI' */
  board: string;
  /** Current head coach */
  coach: string;
  /** Current national team captain */
  captain: string;
  /** Legendary or historically significant players */
  famousPlayers: string[];
}

// ─────────────────────────────────────────────
// League
// ─────────────────────────────────────────────

/**
 * A domestic or franchise cricket tournament/league.
 *
 * Why separate League from Country?
 *   Each country can host multiple leagues (T20, First-Class,
 *   List-A, etc.).  A 1-to-many relationship is cleaner than
 *   embedding league arrays inside Country.
 */
export interface League {
  /** Unique identifier, e.g. 'ipl', 'bbl' */
  id: string;
  /** Foreign key linking to Country.id */
  countryId: string;
  /** Human-readable league name */
  name: string;
  /** Overview of the league */
  description: string;
  /** Year the league was first played */
  established: number;
  /** Cricket format played in this league */
  format: CricketFormat;
  /** Official trophy or prize awarded to winners */
  trophy: string;
  /** Logo / promotional image URL */
  image: string;
}

// ─────────────────────────────────────────────
// Team
// ─────────────────────────────────────────────

/**
 * A franchise or provincial team that competes in a League.
 *
 * Interview tip: `titles` is a plain number — we don't model
 *   individual title years here.  If you needed year-by-year
 *   history you'd add `titleYears: number[]`.
 */
export interface Team {
  /** Unique identifier, e.g. 'csk', 'mi' */
  id: string;
  /** Foreign key linking to League.id */
  leagueId: string;
  /** Official team name, e.g. 'Chennai Super Kings' */
  name: string;
  /** Current team captain */
  captain: string;
  /** Current head coach */
  coach: string;
  /** Primary home stadium */
  homeGround: string;
  /** Number of league titles won */
  titles: number;
  /** Team logo URL */
  logo: string;
  /** Short bio / history of the franchise */
  description: string;
}

// ─────────────────────────────────────────────
// Cricketer
// ─────────────────────────────────────────────

/**
 * An individual cricketer (player profile).
 *
 * Why store teamId instead of the full Team object?
 *   Players change teams every season.  Storing a foreign key
 *   keeps the data normalised and avoids stale nested objects.
 *
 * Interview tip: Normalised data = less duplication = fewer
 *   inconsistency bugs.  This mirrors how relational databases
 *   (and well-designed REST APIs) work.
 */
export interface Cricketer {
  /** Unique identifier, e.g. 'dhoni-csk' */
  id: string;
  /** Foreign key linking to Team.id */
  teamId: string;
  /** Player's full name */
  name: string;
  /** Nationality, e.g. 'India', 'Australia' */
  country: string;
  /** Playing role */
  role: PlayerRole;
  /** Batting stance */
  battingStyle: BattingStyle;
  /** Primary bowling style (empty string if non-bowler) */
  bowlingStyle: string;
  /** Current age in years */
  age: number;
  /** Total career matches in this format */
  matches: number;
  /** Total career runs scored */
  runs: number;
  /** Total career wickets taken */
  wickets: number;
  /** Player bio / career highlights */
  description: string;
  /** Profile photo URL */
  image: string;
}

// ─────────────────────────────────────────────
// Generic API wrapper
// ─────────────────────────────────────────────

/**
 * Standard envelope returned by every API route in this project.
 *
 * Why a generic wrapper?
 *   `ApiResponse<T>` lets you write ONE type for every endpoint
 *   response instead of duplicating `success` / `message` on
 *   every interface.
 *
 * Interview tip: Generic types (T) make your code reusable
 *   without sacrificing type safety.  The compiler resolves T
 *   at each call site, e.g. ApiResponse<Country[]>.
 *
 * Usage:
 *   const res: ApiResponse<Country[]> = await fetchCountries();
 *   if (res.success) render(res.data);
 */
export interface ApiResponse<T> {
  /** The actual payload returned by the API */
  data: T;
  /** True when the request succeeded, false on error */
  success: boolean;
  /** Optional human-readable status or error message */
  message?: string;
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

/**
 * Query parameters for paginated list endpoints.
 *
 * Next.js best practice: Define params as interfaces so you can
 *   spread them into URLSearchParams easily, and so TypeScript
 *   catches typos in key names at compile time.
 *
 * Usage:
 *   const params: PaginationParams = { page: 1, limit: 20 };
 *   const url = `/api/cricketers?page=${params.page}&limit=${params.limit}`;
 */
export interface PaginationParams {
  /** 1-based page number */
  page: number;
  /** Number of items per page */
  limit: number;
}

// ─────────────────────────────────────────────
// Discriminated union / literal types
// ─────────────────────────────────────────────

/**
 * All formats of cricket recognised by this application.
 *
 * Interview tip: Union types (string literals joined with |)
 *   are better than plain `string` here — the compiler will
 *   flag any value that isn't in the list, catching misspellings
 *   like 'Fist-Class' at compile time.
 */
export type CricketFormat =
  | 'Test'
  | 'ODI'
  | 'T20'
  | 'First-Class'
  | 'List-A';

/** A player's primary role on the field */
export type PlayerRole =
  | 'Batsman'
  | 'Bowler'
  | 'All-rounder'
  | 'Wicketkeeper-Batsman'
  | 'Wicketkeeper';

/** Batting hand / stance */
export type BattingStyle =
  | 'Right-handed'
  | 'Left-handed';
