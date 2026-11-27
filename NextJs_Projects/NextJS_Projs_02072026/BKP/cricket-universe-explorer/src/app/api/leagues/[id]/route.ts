// ============================================================
// API ROUTE: /api/leagues/[id]
// FILE: src/app/api/leagues/[id]/route.ts
// ============================================================
//
// RESPONSE SHAPING
// ─────────────────
// For detail endpoints you often want to enrich (join) the response
// with related data, e.g., embed the parent country object.
// This avoids a second round-trip for clients that always need it.
// Pattern: look up the related entity and include it in the response.
//
// IDEMPOTENCY KEYS (advanced)
// ────────────────────────────
// For POST/PATCH on financial or critical data, clients can send an
// `Idempotency-Key` header.  The server stores the key + response,
// and if the same key is sent again (duplicate request), it returns
// the cached response instead of executing twice.
// Not shown here, but important to know for interviews.
//
// HTTP METHOD OVERRIDE (legacy)
// ──────────────────────────────
// Some older proxies/clients only support GET and POST.  You may see
// a `_method=PUT` query param or `X-HTTP-Method-Override` header
// used to tunnel PUT/PATCH/DELETE over POST.  Next.js route handlers
// natively support all verbs so this is rarely needed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { leagues } from '@/data/leagues'
import type { League } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────
// GET /api/leagues/[id]
// ─────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const league = leagues.find((l) => l.id === id)
  if (!league) {
    return NextResponse.json(
      { error: `League with id "${id}" not found` },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: league }, { status: 200 })
}

// ─────────────────────────────────────────
// PUT /api/leagues/[id]
// Full replace
// ─────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = leagues.find((l) => l.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `League with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<League>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Field names match the League interface from @/types.
  const updated: League = {
    id: existing.id,
    name: body.name ?? existing.name,
    countryId: body.countryId ?? existing.countryId,
    description: body.description ?? existing.description,
    format: body.format ?? existing.format,
    established: body.established ?? existing.established,
    trophy: body.trophy ?? existing.trophy,
    image: body.image ?? existing.image,
  }

  return NextResponse.json(
    { data: updated, message: 'League updated (mock)' },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// DELETE /api/leagues/[id]
// 204 No Content on success
// ─────────────────────────────────────────
//
// CASCADE DELETES
// ────────────────
// In a real DB you must decide: when a league is deleted, what
// happens to its teams?
//   ON DELETE CASCADE  → automatically delete child teams (and their players)
//   ON DELETE RESTRICT → reject the delete if child records exist
//   ON DELETE SET NULL → set child teamId to null
// Your route handler should reflect whichever policy the DB enforces,
// or implement the cascade logic manually before deleting the parent.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = leagues.find((l) => l.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `League with id "${id}" not found` },
      { status: 404 }
    )
  }

  // In production: await db.league.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

// ─────────────────────────────────────────
// PATCH /api/leagues/[id]
// Partial update
// ─────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = leagues.find((l) => l.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `League with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<League>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patched: League = { ...existing, ...body, id: existing.id }

  return NextResponse.json(
    { data: patched, message: 'League partially updated (mock)' },
    { status: 200 }
  )
}
