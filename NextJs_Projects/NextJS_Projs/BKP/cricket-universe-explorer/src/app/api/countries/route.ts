// ============================================================
// API ROUTE: /api/countries
// FILE: src/app/api/countries/route.ts
// ============================================================
//
// WHAT IS A ROUTE HANDLER?
// ─────────────────────────
// In Next.js App Router, any file named `route.ts` (or route.js)
// inside `app/` becomes a server-side HTTP endpoint.
// It replaces the old `pages/api/*.ts` pattern from Next.js 12/13.
//
// You export named async functions (GET, POST, PUT, DELETE, PATCH,
// HEAD, OPTIONS) — Next.js maps each to the corresponding HTTP verb.
// There can only be ONE route.ts per folder; if you need a UI page
// at the same path, put the route in a sibling folder.
//
// WHY NextRequest instead of plain Request?
// ──────────────────────────────────────────
// NextRequest extends the web-standard Request with helpers:
//   • request.nextUrl  → parsed URL with pathname, searchParams, etc.
//   • request.cookies  → typed cookie access
//   • request.headers  → same as Request but slightly ergonomic
// You can use a plain `Request` if you don't need those extras, but
// NextRequest is the idiomatic choice in App Router route handlers.
//
// CACHING IN NEXT.JS 15
// ──────────────────────
// Next.js 15 changed the default: route handlers are now UNCACHED
// by default (this reversed the Next.js 14 behaviour where GET
// handlers were cached by default).
//
// To control caching use one of these segment-config exports:
//
//   export const dynamic = 'force-dynamic'
//   // Opt out of ALL caching; always run on every request.
//   // Equivalent to { cache: 'no-store' } on every fetch() inside.
//
//   export const dynamic = 'force-static'
//   // Opt into full static generation; the response is baked at
//   // build time. Good for truly static data.
//
//   export const revalidate = 60
//   // ISR-style: cache for 60 seconds, then re-run in the background.
//   // Works for data that changes infrequently.
//
// For this demo we explicitly set force-dynamic so the search param
// is always fresh (search results must not be cached).
//
// INTERVIEW TIP: Route Handlers vs Server Actions
// ─────────────────────────────────────────────────
// Route Handlers  → HTTP endpoints; called from anywhere (browser,
//                   mobile app, curl, other services).  Must be
//                   explicitly called via fetch().
// Server Actions  → RPC-style functions marked `'use server'`; called
//                   directly from Client Components or forms without
//                   writing fetch() manually.  Not proper REST; not
//                   callable from non-Next.js clients.
// Rule of thumb:
//   Use Server Actions for form submissions / mutations inside the
//   same Next.js app.
//   Use Route Handlers when you need a public-facing API or want
//   standard HTTP semantics.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { countries } from '@/data/countries'
import type { Country } from '@/types'

// force-dynamic: tells Next.js never to cache this route handler.
// This is the right choice when the response depends on runtime
// inputs like query parameters.
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────
// GET /api/countries
// Optional query param: ?search=<string>
// ─────────────────────────────────────────
//
// HTTP GET semantics:
//   • Safe      – does not modify server state
//   • Idempotent – calling it N times produces the same result
//   • Cacheable  – browsers/CDNs may cache GET responses (we opt out
//                  here via force-dynamic because search results vary)
//
// NextResponse.json() sets Content-Type: application/json and
// serialises the value you pass.  It also accepts an options object
// as its second argument for status codes, headers, etc.
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  // request.nextUrl is a NextURL (extends URL) — it gives us a proper
  // URLSearchParams object without manual URL parsing.
  const { searchParams } = request.nextUrl

  // ?search= param: case-insensitive substring match on country name.
  const search = searchParams.get('search')?.toLowerCase().trim()

  const result: Country[] = search
    ? countries.filter((c) => c.name.toLowerCase().includes(search))
    : countries

  // 200 OK is the default status; we include it explicitly for clarity.
  return NextResponse.json(
    {
      data: result,
      total: result.length,
      // Meta included for consumers that want pagination info
      filtered: search ? true : false,
    },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// POST /api/countries
// Body: Partial<Country> (mocked – not persisted to DB)
// ─────────────────────────────────────────
//
// HTTP POST semantics:
//   • NOT safe      – creates a new resource
//   • NOT idempotent – calling it twice creates two resources
//   • 201 Created is the correct success status for resource creation
//   • Best practice: include the created resource in the response body
//     AND a Location header pointing to the new resource's URL.
//
// In a real app you would:
//   1. Validate the body (e.g., with zod)
//   2. Write to the database
//   3. Call revalidatePath('/countries') to bust any cached pages
//   4. Return the DB-generated object (with server-assigned id, timestamps)
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: Partial<Country>

  // request.json() throws if the body is not valid JSON.
  // Always wrap in try/catch or use a schema validator.
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Basic validation — in production use Zod or Yup.
  if (!body.name || !body.shortName) {
    return NextResponse.json(
      { error: 'name and shortName are required' },
      { status: 422 } // 422 Unprocessable Entity: request is well-formed but invalid
    )
  }

  // Mock: generate a new id and merge with defaults.
  // Field names mirror the Country interface from @/types.
  const newCountry: Country = {
    id: `c${Date.now()}`,            // In production: DB auto-increment or UUID
    name: body.name,
    shortName: body.shortName,
    flag: body.flag ?? '🏳️',
    description: body.description ?? '',
    background: body.background ?? '',
    established: body.established ?? new Date().getFullYear(),
    worldCupsWon: body.worldCupsWon ?? 0,
    board: body.board ?? '',
    coach: body.coach ?? '',
    captain: body.captain ?? '',
    famousPlayers: body.famousPlayers ?? [],
  }

  // NOTE: we are NOT pushing to the `countries` array because it is
  // module-level and would only persist for the lifetime of a single
  // server process (and would be lost on the next request in serverless).
  // In production, persist to a database here.

  return NextResponse.json(
    { data: newCountry, message: 'Country created (mock)' },
    {
      status: 201, // 201 Created
      headers: {
        // Location header tells clients where to find the new resource.
        Location: `/api/countries/${newCountry.id}`,
      },
    }
  )
}
