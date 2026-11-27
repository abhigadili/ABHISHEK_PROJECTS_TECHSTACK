// ============================================================
// API ROUTE: /api/leagues
// FILE: src/app/api/leagues/route.ts
// ============================================================
//
// FILTERING BY RELATIONSHIP (countryId)
// ───────────────────────────────────────
// ?countryId= demonstrates a common REST pattern: filtering a
// collection by a foreign-key relationship.
//
// REST URL design:
//   /api/leagues?countryId=c1   → leagues belonging to country c1
//   /api/countries/c1/leagues   → same thing via nested resource URL
//
// Both approaches are valid.  Query params are simpler to implement;
// nested URLs are more RESTfully expressive.  Pick consistently.
//
// ERROR HANDLING STRATEGY
// ────────────────────────
// Route handlers that throw an unhandled error will return a 500.
// In production, wrap your handler body in try/catch and return
// structured error objects so consumers can programmatically handle
// failures (never leak stack traces to API responses).
//
// CORS IN ROUTE HANDLERS
// ───────────────────────
// By default, route handlers do not add CORS headers.
// To allow cross-origin requests (e.g., from a separate frontend),
// add headers to the response or use the OPTIONS handler:
//
//   export async function OPTIONS() {
//     return new NextResponse(null, {
//       status: 204,
//       headers: {
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'GET, POST',
//         'Access-Control-Allow-Headers': 'Content-Type',
//       },
//     })
//   }
//
// MIDDLEWARE vs ROUTE-LEVEL CORS
// ────────────────────────────────
// For project-wide CORS, set headers in middleware.ts instead of
// duplicating them in every route handler.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { leagues } from '@/data/leagues'
import type { League } from '@/types'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────
// GET /api/leagues
// Optional query param: ?countryId=<string>
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const countryId = searchParams.get('countryId')?.trim()

  const result: League[] = countryId
    ? leagues.filter((l) => l.countryId === countryId)
    : leagues

  return NextResponse.json(
    { data: result, total: result.length },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// POST /api/leagues
// Body: Partial<League>
// ─────────────────────────────────────────
//
// When should you validate the foreign key (countryId)?
// ───────────────────────────────────────────────────────
// In production, your database will enforce the FK constraint and
// throw if countryId doesn't exist.  In a mock API you should
// manually check it to mimic the same behaviour and return 422
// rather than silently creating orphan records.
export async function POST(request: NextRequest) {
  let body: Partial<League>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.countryId) {
    return NextResponse.json(
      { error: 'name and countryId are required' },
      { status: 422 }
    )
  }

  // Field names match the League interface from @/types.
  const newLeague: League = {
    id: `l${Date.now()}`,
    name: body.name,
    countryId: body.countryId,
    description: body.description ?? '',
    format: body.format ?? 'T20',
    established: body.established ?? new Date().getFullYear(),
    trophy: body.trophy ?? '',
    image: body.image ?? '',
  }

  return NextResponse.json(
    { data: newLeague, message: 'League created (mock)' },
    {
      status: 201,
      headers: { Location: `/api/leagues/${newLeague.id}` },
    }
  )
}
