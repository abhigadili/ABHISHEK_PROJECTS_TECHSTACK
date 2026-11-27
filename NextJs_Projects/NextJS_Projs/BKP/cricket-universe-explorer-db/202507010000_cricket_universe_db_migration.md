# Cricket Universe Explorer — Database Migration & CRUD Enhancement

**Date:** 2025-07-01  
**Project:** `cricket-universe-explorer-db`  
**Stack:** Next.js 16, React 19, MySQL 8, TypeScript, Tailwind CSS

---

## Overview

This document describes three major enhancements made to the Cricket Universe Explorer project:

1. **Part 1** — MySQL database setup with seeded data
2. **Part 2** — Removal of all mock TypeScript data files; replaced with real MySQL database calls using caching
3. **Part 3** — Add/Edit/Delete (CRUD) UI for all list modules: Countries, Leagues, Teams, Players

---

## Part 1: MySQL Database Setup

### Database: `cricket_universe`

Four tables were created with foreign-key cascade relationships:

```
countries → leagues → teams → cricketers
```

#### Schema

**`countries`**
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(100) PK | e.g. `ind`, `aus` |
| name | VARCHAR(255) | Full country name |
| short_name | VARCHAR(10) | e.g. `IND` |
| flag | VARCHAR(10) | Emoji flag |
| description | TEXT | Overview |
| background | VARCHAR(500) | Hero image URL |
| established | INT | Board founding year |
| world_cups_won | INT | ICC WC wins |
| board | VARCHAR(100) | e.g. `BCCI` |
| coach | VARCHAR(100) | Current coach |
| captain | VARCHAR(100) | Current captain |
| famous_players | JSON | Array of player names |
| created_at / updated_at | TIMESTAMP | Auto-managed |

**`leagues`**
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(100) PK | e.g. `ipl` |
| country_id | VARCHAR(100) FK → countries | Cascade delete |
| name | VARCHAR(255) | |
| description | TEXT | |
| established | INT | |
| format | ENUM | T20, ODI, Test, First-Class, List-A |
| trophy | VARCHAR(255) | Trophy name |
| image | VARCHAR(500) | League logo URL |

**`teams`**
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(100) PK | e.g. `csk` |
| league_id | VARCHAR(100) FK → leagues | Cascade delete |
| name | VARCHAR(255) | |
| captain | VARCHAR(100) | |
| coach | VARCHAR(100) | |
| home_ground | VARCHAR(255) | |
| titles | INT | League titles won |
| logo | VARCHAR(500) | Team logo URL |
| description | TEXT | |

**`cricketers`**
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(100) PK | e.g. `dhoni-csk` |
| team_id | VARCHAR(100) FK → teams | Cascade delete |
| name | VARCHAR(255) | |
| country | VARCHAR(100) | Nationality string |
| role | ENUM | Batsman, Bowler, All-rounder, Wicketkeeper-Batsman, Wicketkeeper |
| batting_style | ENUM | Right-handed, Left-handed |
| bowling_style | VARCHAR(100) | |
| age | INT | |
| matches | INT | |
| runs | INT | |
| wickets | INT | |
| description | TEXT | |
| image | VARCHAR(500) | Profile photo URL |

#### Seeded Data

- **6 countries**: India, Australia, Pakistan, England, West Indies, New Zealand
- **36 leagues**: Multiple per country (IPL, BBL, PSL, The Hundred, CPL, Super Smash, etc.)
- **14 teams**: Across IPL (CSK, MI, RCB, KKR) and BBL/PSL/CPL teams
- **38 cricketers**: Across all seeded teams

#### Setup Script

`setup_db.py` (project root) — Python script that:
- Creates all 4 tables using `IF NOT EXISTS`
- Seeds all data using `INSERT ... ON DUPLICATE KEY UPDATE` (idempotent)
- Escapes SQL strings via `str.replace("'", "''")`
- Uses `subprocess` to pipe SQL to the `mysql` CLI

Run with: `python3 setup_db.py`

---

## Part 2: Remove Mock Data, Add Real DB Queries

### Files Deleted

- `src/data/countries.ts`
- `src/data/leagues.ts`
- `src/data/teams.ts`
- `src/data/cricketers.ts`

### New Files Added

#### `src/lib/db.ts`

MySQL connection pool using `mysql2/promise`:
```typescript
const pool = mysql.createPool({ host, port, user, password, database, connectionLimit: 10 })
```

#### `src/lib/queries.ts`

All database query functions with `unstable_cache` wrapping for 5-minute server-side caching:

| Function | Cache Tag | Description |
|---|---|---|
| `getAllCountries()` | `countries` | All countries |
| `getCountryById(id)` | `countries` | Single country |
| `getAllLeagues()` | `leagues` | All leagues |
| `getLeagueById(id)` | `leagues` | Single league |
| `getLeaguesByCountry(countryId)` | `leagues` | Leagues for a country |
| `getAllTeams()` | `teams` | All teams |
| `getTeamById(id)` | `teams` | Single team |
| `getTeamsByLeague(leagueId)` | `teams` | Teams for a league |
| `getAllCricketers()` | `cricketers` | All cricketers |
| `getCricketerById(id)` | `cricketers` | Single cricketer |
| `getCricketersByTeam(teamId)` | `cricketers` | Players for a team |
| `searchCountries(q)` | (no cache) | Search by name |
| `searchLeagues(countryId?, q?)` | (no cache) | Filter leagues |
| `searchTeams(leagueId?)` | (no cache) | Filter teams |
| `searchCricketersDB(teamId?, role?)` | (no cache) | Filter cricketers |

Row type definitions use snake_case columns; mapper functions convert to camelCase TypeScript interfaces. The `famous_players` JSON column is parsed with a type guard:
```typescript
typeof row.famous_players === 'string' ? JSON.parse(row.famous_players) : row.famous_players
```

#### `.env.local`

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=abhig
DB_PASSWORD=Pass@123
DB_NAME=cricket_universe
```

#### `src/utils/index.ts` (modified)

Re-exports all DB query functions + `formatNumber` + `truncateText`.

### API Routes (Modified)

All 8 API routes updated to use DB queries with `revalidateTag` for cache invalidation after mutations:

- `GET /api/countries` — `getAllCountries()` or `searchCountries(q)`
- `POST /api/countries` — INSERT + `revalidateTag('countries', 'default')`
- `PUT/DELETE/PATCH /api/countries/[id]` — UPDATE/DELETE + revalidateTag
- Same pattern for `/api/leagues/[id]`, `/api/teams/[id]`, `/api/cricketers/[id]`
- Cascade invalidation: deleting a country also invalidates leagues/teams/cricketers tags

### Pages (Modified)

All pages updated to `await` DB query functions (previously sync mock lookups):

- `src/app/countries/page.tsx` — `await getAllCountries()`
- `src/app/countries/[countryId]/page.tsx` — `await getCountryById(id)`
- `src/app/countries/[countryId]/leagues/page.tsx` — parallel fetch country + leagues
- `src/app/countries/[countryId]/leagues/[leagueId]/page.tsx` — parallel fetch + teams
- `src/app/teams/[teamId]/page.tsx` — `await getTeamById` + `getCricketersByTeam`
- `src/app/cricketers/[cricketerId]/page.tsx` — `await getCricketerById`
- `src/app/page.tsx` (home) — `await getAllCountries()`
- `src/app/(dashboard)/dashboard/@stats/page.tsx` — parallel fetch all 4 counts
- `src/app/countries/[countryId]/leagues/[leagueId]/teams/[teamId]/page.tsx` — parallel fetch all 3 entities
- `src/app/countries/@modal/(.)countries/[countryId]/page.tsx` — split into server+client

`generateStaticParams()` removed from all pages (data is now dynamic/DB-backed).

---

## Part 3: CRUD UI for All List Modules

### New Files

#### `src/components/crud/Modal.tsx`

Reusable modal wrapper (`'use client'`):
- Escape key to close
- Backdrop click to close
- Title + children slot

#### `src/components/crud/CountriesManager.tsx`

CRUD manager for the `/countries` page:
- **Add**: Modal form with all Country fields (name, shortName, flag, board, captain, coach, established, worldCupsWon, description, famousPlayers)
- **Edit**: Pre-fills form with existing data
- **Delete**: Confirmation dialog → DELETE `/api/countries/:id`
- Hover-revealed Edit/Delete buttons on each card (`group/card` + `group-hover/card:opacity-100`)
- `famousPlayers` field: comma-separated string in form, converted to array on submit

#### `src/components/crud/LeaguesManager.tsx`

CRUD manager for the leagues list under each country:
- Props: `initialLeagues: League[]`, `countryId: string`
- Form fields: name, format (dropdown), established, trophy, description
- Links to `/countries/{countryId}/leagues/{leagueId}`

#### `src/components/crud/TeamsManager.tsx`

CRUD manager for the teams list under each league:
- Props: `initialTeams: Team[]`, `leagueId: string`
- Form fields: name, captain, coach, homeGround, titles, description
- Links to `/teams/{teamId}`

#### `src/components/crud/CricketersManager.tsx`

CRUD manager for the players list under each team:
- Props: `initialCricketers: Cricketer[]`, `teamId: string`
- Form fields: name, country, role (dropdown), battingStyle (dropdown), bowlingStyle, age, matches, runs, wickets, description
- Role-colored badges (Batsman=blue, Bowler=red, All-rounder=emerald, etc.)
- Stat grid (Matches / Runs / Wickets) on each player card
- Links to `/cricketers/{cricketerId}`

### CRUD Pattern

Each manager follows the same pattern:
1. Server page fetches initial data from DB, passes as `initialX` prop
2. Client manager holds state with `useState(initialX)`
3. On Add → `POST /api/{resource}` → append to state
4. On Edit → `PUT /api/{resource}/:id` → replace in state
5. On Delete → `DELETE /api/{resource}/:id` → filter from state
6. No page refresh needed — optimistic client state update

---

## Breaking Changes Fixed (Next.js 16)

- `revalidateTag(tag)` → `revalidateTag(tag, 'default')` (Next.js 16 requires second `profile` argument)
- `@modal` intercepting route split into server component (data fetch) + client component (`useRouter`)
- All `generateStaticParams()` removed (incompatible with dynamic DB-backed data)

---

## File Structure Summary

```
src/
├── lib/
│   ├── db.ts              # MySQL connection pool
│   └── queries.ts         # All DB query functions with caching
├── components/crud/
│   ├── Modal.tsx
│   ├── CountriesManager.tsx
│   ├── LeaguesManager.tsx
│   ├── TeamsManager.tsx
│   └── CricketersManager.tsx
├── app/
│   ├── api/
│   │   ├── countries/route.ts + [id]/route.ts
│   │   ├── leagues/route.ts + [id]/route.ts
│   │   ├── teams/route.ts + [id]/route.ts
│   │   └── cricketers/route.ts + [id]/route.ts
│   └── countries/
│       └── @modal/(.)countries/[countryId]/
│           ├── page.tsx              # server component
│           └── CountryModalClient.tsx  # client component
setup_db.py                          # DB setup + seed script
.env.local                           # DB credentials
```
