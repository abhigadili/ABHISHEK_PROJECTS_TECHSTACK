# Cricket Universe Explorer

> A production-quality Next.js 15+ learning application demonstrating all major Next.js concepts through a real cricket data explorer.

Built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Zustand v5**. Every file is thoroughly commented to serve as a self-documenting reference for interviews and production development.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Next.js Concepts Covered](#nextjs-concepts-covered)
  - [Routing (all types)](#routing-all-types)
  - [Server and Client Components](#server-and-client-components)
  - [Data Fetching and Caching](#data-fetching-and-caching)
  - [API Routes](#api-routes)
  - [Middleware](#middleware)
  - [Authentication](#authentication)
  - [State Management](#state-management)
  - [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Learning Guide](#learning-guide)
- [Interview Tips](#interview-tips)

---

## Project Overview

Cricket Universe Explorer lets you browse 6 cricket nations, 36 domestic leagues, 14 franchise teams, and dozens of player profiles. The real goal is to demonstrate every meaningful Next.js routing and data-fetching pattern in a single cohesive codebase — with heavy inline comments explaining the **why** behind every decision.

**What makes this a learning resource:**
- Every `page.tsx`, `layout.tsx`, and `route.ts` has a JSDoc header explaining the Next.js concept it demonstrates.
- All 8 routing types are implemented with working examples.
- Server Components, Client Components, and their correct boundaries are shown side-by-side.
- Authentication uses the correct HttpOnly cookie pattern (not localStorage).
- State management shows 4 approaches with a comparison guide.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2.9 | App Router, SSR/SSG/ISR, API routes |
| React | 19.2.4 | Server + Client Components |
| TypeScript | 5.x | Type safety throughout |
| Tailwind CSS | 4.x | Utility-first styling |
| Zustand | 5.0.x | Global client state management |
| Jest | 30.x | Unit and component testing |
| Testing Library | 16.x | React component testing |

---

## Quick Start

```bash
# Clone and install
npm install

# Start development server
npm run dev

# Open in browser
# http://localhost:3000

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
```

**Test login credentials:** Any email address containing `@` and any password longer than 3 characters will work with the mock auth system.

---

## Project Structure

```
cricket-universe-explorer/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Navbar, Footer, fonts)
│   │   ├── page.tsx                  # Home page /
│   │   ├── loading.tsx               # Root loading UI (Suspense fallback)
│   │   ├── error.tsx                 # Root error boundary
│   │   ├── not-found.tsx             # 404 page
│   │   │
│   │   ├── (auth)/                   # Route group — auth pages
│   │   │   ├── layout.tsx            # Auth layout (centred card)
│   │   │   └── login/
│   │   │       └── page.tsx          # /login
│   │   │
│   │   ├── (dashboard)/              # Route group — protected pages
│   │   │   ├── layout.tsx            # Dashboard layout (sidebar)
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx        # Parallel routes layout
│   │   │       ├── page.tsx          # /dashboard (children slot)
│   │   │       ├── @stats/
│   │   │       │   └── page.tsx      # @stats parallel slot
│   │   │       └── @recentActivity/
│   │   │           └── page.tsx      # @recentActivity parallel slot
│   │   │
│   │   ├── about/
│   │   │   └── page.tsx              # /about (static route)
│   │   │
│   │   ├── countries/
│   │   │   ├── layout.tsx            # Countries layout (modal slot)
│   │   │   ├── page.tsx              # /countries
│   │   │   ├── loading.tsx           # Countries loading skeleton
│   │   │   ├── @modal/               # Intercepting route modal slot
│   │   │   │   ├── default.tsx       # null (no modal by default)
│   │   │   │   └── (.)countries/
│   │   │   │       └── [countryId]/
│   │   │   │           └── page.tsx  # Modal version of country detail
│   │   │   └── [countryId]/          # Dynamic route
│   │   │       ├── page.tsx          # /countries/[id]
│   │   │       └── leagues/
│   │   │           ├── page.tsx      # /countries/[id]/leagues
│   │   │           ├── [leagueId]/
│   │   │           │   ├── page.tsx  # /countries/[id]/leagues/[id]
│   │   │           │   └── teams/
│   │   │           │       └── [teamId]/
│   │   │           │           └── page.tsx  # 3-level nested route
│   │   │           └── ...
│   │   │
│   │   ├── cricketers/
│   │   │   └── [cricketerId]/
│   │   │       └── page.tsx          # /cricketers/[id]
│   │   │
│   │   ├── teams/
│   │   │   └── [teamId]/
│   │   │       └── page.tsx          # /teams/[id]
│   │   │
│   │   ├── docs/
│   │   │   └── [...slug]/
│   │   │       └── page.tsx          # /docs/routing, /docs/api, etc.
│   │   │
│   │   ├── examples/
│   │   │   └── [[...slug]]/
│   │   │       └── page.tsx          # /examples, /examples/anything
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx              # /dashboard (original version)
│   │   │
│   │   ├── profile/
│   │   │   └── page.tsx              # /profile
│   │   │
│   │   └── api/                      # API Route Handlers
│   │       ├── auth/
│   │       │   ├── login/route.ts    # POST /api/auth/login
│   │       │   ├── logout/route.ts   # POST /api/auth/logout
│   │       │   └── me/route.ts       # GET  /api/auth/me
│   │       ├── countries/
│   │       │   ├── route.ts          # GET  /api/countries
│   │       │   └── [id]/route.ts     # GET  /api/countries/[id]
│   │       ├── leagues/
│   │       │   ├── route.ts          # GET  /api/leagues
│   │       │   └── [id]/route.ts     # GET  /api/leagues/[id]
│   │       ├── teams/
│   │       │   ├── route.ts          # GET  /api/teams
│   │       │   └── [id]/route.ts     # GET  /api/teams/[id]
│   │       └── cricketers/
│   │           ├── route.ts          # GET  /api/cricketers
│   │           └── [id]/route.ts     # GET  /api/cricketers/[id]
│   │
│   ├── components/
│   │   ├── Navbar.tsx                # Global navigation bar
│   │   ├── Footer.tsx                # Global footer
│   │   ├── Sidebar.tsx               # Collapsible country nav sidebar
│   │   ├── ProfileHeader.tsx         # Reusable profile header
│   │   └── ui/
│   │       ├── Breadcrumb.tsx        # Breadcrumb navigation
│   │       ├── CountryCard.tsx       # Country card component
│   │       ├── CricketerCard.tsx     # Player card component
│   │       ├── EmptyState.tsx        # Empty state placeholder
│   │       ├── LeagueCard.tsx        # League card component
│   │       ├── Loading.tsx           # Loading spinner
│   │       ├── Pagination.tsx        # Pagination controls
│   │       ├── SearchBar.tsx         # Search input component
│   │       ├── StatsCard.tsx         # Stats display card
│   │       └── TeamCard.tsx          # Team card component
│   │
│   ├── context/
│   │   ├── CountryContext.tsx        # React Context example
│   │   └── ThemeContext.tsx          # Theme context example
│   │
│   ├── data/
│   │   ├── countries.ts              # 6 cricket nations
│   │   ├── leagues.ts                # 36 domestic leagues
│   │   ├── teams.ts                  # 14 franchise teams
│   │   └── cricketers.ts             # Player profiles
│   │
│   ├── features/
│   │   └── countries/
│   │       ├── CountriesListClient.tsx  # Client Component list with search/filter
│   │       └── CountryProfile.tsx       # Server Component country profile
│   │
│   ├── hooks/
│   │   ├── useCountries.ts           # Countries data hook
│   │   ├── useDebounce.ts            # Debounce hook for search
│   │   ├── useFavorite.ts            # Favorites with localStorage
│   │   └── useLocalStorage.ts        # Generic localStorage hook
│   │
│   ├── lib/
│   │   ├── api.ts                    # Client-side API fetch helpers
│   │   └── auth.ts                   # Server-side auth utilities
│   │
│   ├── store/
│   │   ├── favoritesStore.ts         # Zustand favorites store
│   │   └── searchStore.ts            # Zustand search store
│   │
│   ├── types/
│   │   └── index.ts                  # All TypeScript interfaces
│   │
│   ├── utils/
│   │   └── index.ts                  # Pure utility functions
│   │
│   ├── constants/
│   │   └── index.ts                  # App-wide constants
│   │
│   ├── middleware.ts                  # Route protection middleware
│   └── providers.tsx                  # Client providers wrapper
│
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── jest.config.ts
├── jest.setup.ts
└── package.json
```

---

## Next.js Concepts Covered

### Routing (all types)

All 8 routing types from the Next.js App Router are demonstrated with working examples.

#### Static Routes

The simplest routes — a folder with a `page.tsx`. No dynamic segments.

| File | URL |
|------|-----|
| `src/app/page.tsx` | `/` |
| `src/app/about/page.tsx` | `/about` |
| `src/app/profile/page.tsx` | `/profile` |
| `src/app/dashboard/page.tsx` | `/dashboard` |

```typescript
// app/about/page.tsx — simplest possible route
export default function AboutPage() {
  return <h1>About</h1>
}
```

#### Dynamic Routes

Folders wrapped in `[brackets]` capture URL segments as params.

| File | URL Example |
|------|-------------|
| `src/app/countries/[countryId]/page.tsx` | `/countries/ind` |
| `src/app/teams/[teamId]/page.tsx` | `/teams/csk` |
| `src/app/cricketers/[cricketerId]/page.tsx` | `/cricketers/dhoni-csk` |

**Key pattern in Next.js 15+:** `params` is a `Promise` — always `await` it.

```typescript
// app/countries/[countryId]/page.tsx
export default async function CountryPage({
  params,
}: {
  params: Promise<{ countryId: string }>
}) {
  const { countryId } = await params  // MUST await in Next.js 15+
  const country = getCountryById(countryId)
  if (!country) notFound()
  return <div>{country.name}</div>
}
```

#### Nested Dynamic Routes (2 levels)

Two dynamic segments in the URL path.

| File | URL Example |
|------|-------------|
| `src/app/countries/[countryId]/leagues/[leagueId]/page.tsx` | `/countries/ind/leagues/ipl` |

```typescript
// Both segments resolved from a single await
const { countryId, leagueId } = await params
```

#### Deeply Nested Dynamic Routes (3 levels)

Three dynamic segments demonstrating arbitrary nesting depth.

| File | URL Example |
|------|-------------|
| `src/app/countries/[countryId]/leagues/[leagueId]/teams/[teamId]/page.tsx` | `/countries/ind/leagues/ipl/teams/csk` |

```typescript
// All three segments from one await
const { countryId, leagueId, teamId } = await params
```

#### Catch-All Routes

`[...slug]` matches one or more path segments. `params.slug` is `string[]`.

| File | URL Examples |
|------|-------------|
| `src/app/docs/[...slug]/page.tsx` | `/docs/routing`, `/docs/api/handlers` |

```typescript
// slug = ['routing'] for /docs/routing
// slug = ['api', 'handlers'] for /docs/api/handlers
const { slug } = await params
```

#### Optional Catch-All Routes

`[[...slug]]` matches the root URL AND sub-paths. `params.slug` may be `undefined`.

| File | URL Examples |
|------|-------------|
| `src/app/examples/[[...slug]]/page.tsx` | `/examples`, `/examples/routing`, `/examples/any/path` |

```typescript
// slug = undefined for /examples
// slug = ['routing'] for /examples/routing
const { slug } = await params
// Always check: if (!slug) { /* show index */ }
```

#### Route Groups

Folders wrapped in `(parentheses)` organise routes without affecting the URL. Used for:
1. Applying different layouts to different route sections.
2. Organising code without polluting URL namespace.

| File | URL | Purpose |
|------|-----|---------|
| `src/app/(auth)/layout.tsx` | N/A | Auth section layout (centred card) |
| `src/app/(auth)/login/page.tsx` | `/login` | Login page — not `/(auth)/login` |
| `src/app/(dashboard)/layout.tsx` | N/A | Dashboard section layout (sidebar) |
| `src/app/(dashboard)/dashboard/page.tsx` | `/dashboard` | Protected dashboard |

```typescript
// app/(dashboard)/layout.tsx
// Wraps all routes in (dashboard)/ group with a sidebar.
// The URL is still /dashboard — the (dashboard) folder is invisible in URLs.
export default function DashboardGroupLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

#### Parallel Routes

`@folder` convention renders multiple pages simultaneously in the same layout. Each slot:
- Loads independently (its own Suspense boundary).
- Can have its own `loading.tsx` and `error.tsx`.
- Is passed as a named prop to the parent layout.

| Files | Slot | Description |
|-------|------|-------------|
| `src/app/(dashboard)/dashboard/layout.tsx` | — | Receives `children`, `stats`, `recentActivity` |
| `src/app/(dashboard)/dashboard/page.tsx` | `children` | Main dashboard content |
| `src/app/(dashboard)/dashboard/@stats/page.tsx` | `stats` | Universe stats panel |
| `src/app/(dashboard)/dashboard/@recentActivity/page.tsx` | `recentActivity` | Activity feed |

```typescript
// app/(dashboard)/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  stats,
  recentActivity,
}: {
  children: React.ReactNode
  stats: React.ReactNode
  recentActivity: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">{children}</div>
      <div>
        {stats}
        {recentActivity}
      </div>
    </div>
  )
}
```

**Parallel Routes vs Layout with Components:**

| Aspect | Parallel Routes | Layout Components |
|--------|-----------------|------------------|
| Loading isolation | Each slot independent | All block together |
| Error isolation | Per-slot error.tsx | Shared error boundary |
| Independent navigation | Yes | No |
| Complexity | Higher | Lower |
| Best for | Dashboard with slow/independent panels | Simple shared UI |

#### Intercepting Routes

Catch client-side navigation to a URL and render a modal instead. The full page still renders on hard refresh or direct URL access.

Convention:
- `(.)` — intercept same-level URL segment
- `(..)` — intercept one level up
- `(..)(..)` — intercept two levels up
- `(...)` — intercept from app root

| Files | URL Intercepted |
|-------|----------------|
| `src/app/countries/@modal/default.tsx` | No modal (null fallback) |
| `src/app/countries/@modal/(.)countries/[countryId]/page.tsx` | `/countries/[id]` (when navigated from `/countries`) |
| `src/app/countries/layout.tsx` | Provides the `modal` slot |

**How it works:**

```
User on /countries → clicks "View India"
  → Client-side nav to /countries/ind
  → Intercepting route fires → modal renders over /countries
  → URL shows /countries/ind (shareable!)

User opens /countries/ind in new tab (hard nav)
  → Intercepting route does NOT fire
  → Full app/countries/[countryId]/page.tsx renders
```

---

### Server and Client Components

Next.js App Router defaults to Server Components. Understanding the boundary is critical.

**Server Components (default — no directive needed):**
- Run only on the server (or at build time for SSG).
- Can read databases, file system, secrets.
- Cannot use `useState`, `useEffect`, event handlers.
- Zero client-side JavaScript — best for performance.

```typescript
// Server Component (default) — no 'use client'
export default async function CountryPage({ params }) {
  const { countryId } = await params
  const country = getCountryById(countryId) // server-only data access
  return <div>{country.name}</div>
}
```

**Client Components (`'use client'` directive):**
- Ship to the browser — interactive.
- Can use `useState`, `useEffect`, event handlers, browser APIs.
- Cannot directly read server-only resources.

```typescript
'use client'
import { useState } from 'react'

export default function SearchBar() {
  const [query, setQuery] = useState('')  // browser state
  return <input onChange={(e) => setQuery(e.target.value)} />
}
```

**The key pattern — composition:**

```typescript
// Server Component (parent) — fetches data
export default async function CountriesPage() {
  const countries = getAllCountries() // server-only
  return <CountriesListClient countries={countries} /> // pass to client
}

// Client Component (child) — handles interaction
'use client'
export default function CountriesListClient({ countries }) {
  const [search, setSearch] = useState('')
  // search/filter happens client-side
}
```

---

### Data Fetching and Caching

This project uses static in-memory data. In a production app, replace with `fetch()` calls.

#### Caching Strategies

```typescript
// 1. Static (default) — cached indefinitely, served from CDN
const data = await fetch('https://api.example.com/countries')

// 2. ISR — revalidate every hour
const data = await fetch('https://api.example.com/countries', {
  next: { revalidate: 3600 }
})

// 3. No cache — fresh on every request (SSR)
const data = await fetch('https://api.example.com/user-data', {
  cache: 'no-store'
})

// 4. Tag-based revalidation — revalidate by tag
const data = await fetch('https://api.example.com/countries', {
  next: { tags: ['countries'] }
})
// Revalidate from a Server Action:
// revalidateTag('countries')
```

#### generateStaticParams

Pre-renders dynamic routes at build time. Returns an array of param objects.

```typescript
// Pre-render /countries/ind, /countries/aus, etc. at build time
export function generateStaticParams() {
  return getAllCountries().map((c) => ({ countryId: c.id }))
}
```

For nested routes, all dynamic segments must be included:

```typescript
// For /countries/[countryId]/leagues/[leagueId]/teams/[teamId]
export function generateStaticParams() {
  return getAllTeams().map((team) => {
    const league = getLeagueById(team.leagueId)
    return {
      countryId: league.countryId,
      leagueId:  team.leagueId,
      teamId:    team.id,
    }
  })
}
```

---

### API Routes

Route Handlers (`route.ts`) replace `pages/api/` from the Pages Router.

```typescript
// app/api/countries/route.ts — GET /api/countries
import { NextResponse } from 'next/server'
import { getAllCountries } from '@/utils'

export async function GET() {
  const countries = getAllCountries()
  return NextResponse.json({ data: countries, success: true })
}

// app/api/countries/[id]/route.ts — GET /api/countries/csk
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const country = getCountryById(id)
  if (!country) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ data: country, success: true })
}
```

**Available API Routes in this project:**

| Method | URL | Returns |
|--------|-----|---------|
| GET | `/api/countries` | All countries |
| GET | `/api/countries/[id]` | Single country |
| GET | `/api/leagues` | All leagues |
| GET | `/api/leagues/[id]` | Single league |
| GET | `/api/teams` | All teams |
| GET | `/api/teams/[id]` | Single team |
| GET | `/api/cricketers` | All cricketers |
| GET | `/api/cricketers/[id]` | Single cricketer |
| POST | `/api/auth/login` | Set auth cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/auth/me` | Current user |

---

### Middleware

`src/middleware.ts` runs before every matching request — before any layout or page renders.

**Location:** Must be at `src/middleware.ts` (same level as `app/`). Not at the project root when using a `src/` layout.

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth-token')?.value

  const isProtectedRoute = ['/dashboard', '/profile'].some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedRoute && !authToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/api/:path*'],
}
```

**Middleware also provides:**
- Request ID generation (`crypto.randomUUID()`) for distributed tracing.
- Custom response headers (`x-request-id`, `x-app-name`, `x-app-version`).

---

### Authentication

Cookie-based auth using HttpOnly cookies. No localStorage, no JWT in client JavaScript.

**Flow:**

```
1. User submits login form (POST /api/auth/login)
2. Server validates credentials (any email + password > 3 chars)
3. Server sets HttpOnly cookie: auth-token=<encoded-payload>
4. Browser stores cookie — inaccessible to JavaScript (XSS-safe)
5. Subsequent requests include cookie automatically
6. Server reads cookie in Server Components: await cookies()
7. getCurrentUser(cookieStore) decodes and validates session
8. If invalid → redirect('/login')
```

**Why HttpOnly cookies over localStorage:**

| | HttpOnly Cookie | localStorage |
|--|----------------|-------------|
| XSS readable | No (protected) | Yes (vulnerable) |
| CSRF risk | Yes (use SameSite) | No |
| Sent automatically | Yes | No (manual header) |
| Best for | Auth tokens | Non-sensitive preferences |

```typescript
// Correct: server-side auth check in a Server Component
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const cookieStore = await cookies()  // async in Next.js 15+
  const user = getCurrentUser(cookieStore)
  if (!user) redirect('/login')       // server-side redirect — no flash
}
```

---

### State Management

This project demonstrates 4 state management approaches.

| Feature | useState | useReducer | Context | Zustand |
|---------|----------|------------|---------|---------|
| Scope | Component | Component | Tree-wide | Global |
| Persistence across navigation | No | No | No | Yes (with persist) |
| DevTools support | No | No | No | Yes |
| Server Component compatible | No | No | No | No |
| Best for | Simple UI state | Complex state transitions | Theme/Auth | Global app state |
| Re-render behaviour | Component only | Component only | All consumers | Only subscribed components |

**useState** — for local, transient UI state:

```typescript
'use client'
const [isOpen, setIsOpen] = useState(false)
const [query, setQuery] = useState('')
```

**useReducer** — for complex state with multiple transitions:

```typescript
'use client'
const [state, dispatch] = useReducer(searchReducer, initialState)
dispatch({ type: 'SET_QUERY', payload: 'India' })
```

**React Context** — tree-wide state without prop drilling:

```typescript
// context/ThemeContext.tsx — provides theme to all descendants
// context/CountryContext.tsx — provides selected country
```

**Zustand** — global state that survives navigation:

```typescript
// store/favoritesStore.ts
import { create } from 'zustand'

const useFavoritesStore = create((set) => ({
  favorites: [],
  addFavorite: (id) => set((state) => ({
    favorites: [...state.favorites, id]
  })),
}))
```

---

### Testing

```bash
npm test                    # run all tests
npm run test:watch          # watch mode
npm run test:coverage       # coverage report
```

**Test setup:**
- **Jest 30** with `ts-jest` for TypeScript support.
- **jest-environment-jsdom** for browser API simulation.
- **Testing Library** for component and user-event testing.
- Config: `jest.config.ts`, setup: `jest.setup.ts`.

**What to test:**
- Pure utility functions in `src/utils/index.ts` (no DOM needed).
- API route handlers (mock `NextResponse`).
- Client Components with user interactions (Testing Library).

---

## Environment Variables

```bash
# .env.local (create this file — not committed to git)

# Optional: custom site description for metadata
NEXT_PUBLIC_SITE_DESCRIPTION=Explore cricket countries, leagues, teams and players.

# Optional: shown in custom response headers by middleware
NEXT_PUBLIC_APP_NAME=Cricket Universe Explorer
NEXT_PUBLIC_APP_VERSION=1.0.0
```

`NEXT_PUBLIC_` prefix makes variables available in the browser bundle. Never use this prefix for secrets (API keys, DB passwords) — they'd be exposed in the client.

---

## Learning Guide

Work through the concepts in this order:

### 1. Start with Static Routes
Read `src/app/page.tsx` and `src/app/about/page.tsx`. Notice: no `'use client'`, no imports, just a function returning JSX. These are Server Components.

### 2. Understand Layouts
Read `src/app/layout.tsx`. The root layout wraps every page. Notice `Navbar` and `Footer` appear on all pages because they live here.

### 3. Dynamic Routes
Read `src/app/countries/[countryId]/page.tsx`. Note: `await params` is required in Next.js 15+. See `generateStaticParams()` and `generateMetadata()` patterns.

### 4. Nested Dynamic Routes
Read `src/app/countries/[countryId]/leagues/[leagueId]/page.tsx`. Note: `generateStaticParams()` returns objects with BOTH keys.

### 5. Catch-All and Optional Catch-All
Compare `src/app/docs/[...slug]/page.tsx` vs `src/app/examples/[[...slug]]/page.tsx`. Understand when slug is undefined.

### 6. API Routes
Read `src/app/api/countries/route.ts` then `src/app/api/auth/login/route.ts`. Notice how cookies are set via the response object.

### 7. Authentication
Read `src/middleware.ts` for route-level protection. Then read `src/app/dashboard/page.tsx` for page-level auth check. Compare the two approaches.

### 8. Route Groups
Read `src/app/(auth)/layout.tsx` and `src/app/(dashboard)/layout.tsx`. Notice how both are nested inside the root layout.

### 9. Parallel Routes
Read `src/app/(dashboard)/dashboard/layout.tsx` with its `@stats` and `@recentActivity` slots. Run the app and observe all three sections loading.

### 10. Intercepting Routes
Read `src/app/countries/@modal/(.)countries/[countryId]/page.tsx`. Navigate from `/countries` to a country — see the modal. Hard-refresh on `/countries/ind` — see the full page. Same URL, different rendering based on navigation method.

---

## Interview Tips

This project is designed to help you answer the following common Next.js interview questions:

**Routing:**
- "Explain all the routing types in Next.js App Router." — See all 8 types implemented in this project.
- "What's the difference between `[...slug]` and `[[...slug]]`?" — Compare `/docs` and `/examples` routes.
- "How do route groups work? When would you use them?" — See `(auth)` and `(dashboard)` groups.
- "What are parallel routes and when would you use them over a layout with components?" — See `@stats` and `@recentActivity` slots and the comparison table above.
- "Explain intercepting routes with a real use case." — See the country modal pattern.

**Server vs Client Components:**
- "When do you use `'use client'`?" — Only when you need browser APIs, event handlers, hooks, or state.
- "Can a Server Component import a Client Component? The reverse?" — Server can import Client. Client cannot import Server directly (use composition instead).
- "How do you pass data from a Server Component to a Client Component?" — Via props (see `CountriesListClient`).

**Performance:**
- "What caching options does `fetch()` support in Next.js?" — static (default), `revalidate`, `no-store`, `tags`.
- "What is `generateStaticParams()`?" — Pre-renders dynamic routes at build time as static HTML.
- "Where does middleware run?" — Edge Runtime, before routing, geographically close to the user.

**Authentication:**
- "Why use HttpOnly cookies instead of localStorage for auth tokens?" — XSS cannot read HttpOnly cookies; localStorage is readable by any JavaScript.
- "How does `cookies()` work in Next.js 15+?" — It's async. Always `await cookies()`.
- "What's the difference between middleware auth and page-level auth?" — Middleware is early (before render), page-level is fine-grained (full Node.js access).

**State Management:**
- "How do you choose between useState, useReducer, Context, and Zustand?" — See the comparison table in the State Management section.
- "Can you use Zustand in a Server Component?" — No. Zustand is client-only. Server Components use async/await data fetching instead of state.
