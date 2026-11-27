// ============================================================
// API ROUTE: /api/cricketers/[id]
// FILE: src/app/api/cricketers/[id]/route.ts
// ============================================================
//
// CONTENT NEGOTIATION
// ────────────────────
// REST APIs can return different formats based on the Accept header:
//   Accept: application/json  → return JSON (default)
//   Accept: text/csv          → return CSV export
//
// Check it in the handler:
//   const accept = request.headers.get('accept')
//   if (accept?.includes('text/csv')) { return csvResponse() }
//
// Next.js route handlers support any response type via new Response()
// or NextResponse with a custom Content-Type header.
//
// ETAG / CONDITIONAL REQUESTS
// ────────────────────────────
// ETags reduce bandwidth for unchanged resources:
//   1. Server returns: ETag: "abc123"
//   2. Client caches response.
//   3. Next request: If-None-Match: "abc123"
//   4. If data unchanged: 304 Not Modified (no body, saves bandwidth)
//   5. If changed: 200 with new data + new ETag
//
// Generate an ETag from a hash of the data:
//   const etag = createHash('md5').update(JSON.stringify(data)).digest('hex')
//   if (request.headers.get('if-none-match') === etag) {
//     return new NextResponse(null, { status: 304 })
//   }
//
// VERSIONING
// ──────────────
// As APIs evolve, version them to avoid breaking existing clients:
//   URL versioning:    /api/v1/cricketers, /api/v2/cricketers
//   Header versioning: Accept: application/vnd.cricket.v2+json
//   Query param:       /api/cricketers?version=2
//
// URL versioning is simplest and most visible; used by most public APIs.
// In Next.js, create src/app/api/v1/ and src/app/api/v2/ folder trees.
//
// NEXT.JS 15 ASYNC PARAMS — SUMMARY
// ───────────────────────────────────
// Always: const { id } = await params
// Never:  const { id } = params   ← works accidentally but will break
//                                     in future Next.js versions
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { cricketers } from '@/data/cricketers'
import type { Cricketer } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────
// GET /api/cricketers/[id]
// ─────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const cricketer = cricketers.find((c) => c.id === id)
  if (!cricketer) {
    return NextResponse.json(
      { error: `Cricketer with id "${id}" not found` },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: cricketer }, { status: 200 })
}

// ─────────────────────────────────────────
// PUT /api/cricketers/[id]
// Full replace
// ─────────────────────────────────────────
//
// CONCURRENCY / OPTIMISTIC LOCKING
// ──────────────────────────────────
// In high-traffic scenarios two users might read the same record,
// both modify it, and both PUT simultaneously — the "last write wins"
// and the first user's changes are silently lost ("lost update problem").
//
// Solution — optimistic locking:
//   1. GET returns a version field (e.g., version: 3)
//   2. PUT request includes the version it based the edit on
//   3. Server checks: if DB version !== sent version → 409 Conflict
//   4. Client must re-fetch and re-apply their changes
//
// Pessimistic locking (SELECT FOR UPDATE in SQL) is an alternative but
// hurts concurrency since it holds a DB lock for the entire operation.
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = cricketers.find((c) => c.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Cricketer with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<Cricketer>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Field names match the Cricketer interface from @/types.
  const updated: Cricketer = {
    id: existing.id,
    name: body.name ?? existing.name,
    teamId: body.teamId ?? existing.teamId,
    role: body.role ?? existing.role,
    country: body.country ?? existing.country,
    battingStyle: body.battingStyle ?? existing.battingStyle,
    bowlingStyle: body.bowlingStyle ?? existing.bowlingStyle,
    age: body.age ?? existing.age,
    matches: body.matches ?? existing.matches,
    runs: body.runs ?? existing.runs,
    wickets: body.wickets ?? existing.wickets,
    description: body.description ?? existing.description,
    image: body.image ?? existing.image,
  }

  return NextResponse.json(
    { data: updated, message: 'Cricketer updated (mock)' },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// DELETE /api/cricketers/[id]
// ─────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = cricketers.find((c) => c.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Cricketer with id "${id}" not found` },
      { status: 404 }
    )
  }

  // In production: await db.cricketer.delete({ where: { id } })
  // Then: revalidatePath(`/teams/${existing.teamId}`)
  return new NextResponse(null, { status: 204 })
}

// ─────────────────────────────────────────
// PATCH /api/cricketers/[id]
// Partial update — e.g., change team (transfer) or update captain flag
// ─────────────────────────────────────────
//
// Real-world PATCH use cases for cricketers:
//   • PATCH { teamId: 'mi' }            → player transfer between teams
//   • PATCH { role: 'All-rounder' }     → role re-classification
//   • PATCH { runs: 8500, matches: 260} → update career stats after a season
// Each only touches the relevant field — PUT would require sending
// the entire player object even for a single-field change.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = cricketers.find((c) => c.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Cricketer with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<Cricketer>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Spread: existing fields kept; body fields override.
  // id is always preserved from the URL — clients cannot change it.
  const patched: Cricketer = { ...existing, ...body, id: existing.id }

  return NextResponse.json(
    { data: patched, message: 'Cricketer partially updated (mock)' },
    { status: 200 }
  )
}
