// ============================================================
// API ROUTE: /api/countries/[id]
// FILE: src/app/api/countries/[id]/route.ts
// ============================================================
//
// DYNAMIC ROUTE SEGMENTS
// ───────────────────────
// The folder `[id]` creates a dynamic segment. Next.js passes the
// matched value to your handler via the `params` Promise argument.
//
// Signature in Next.js 15:
//   async function GET(
//     request: NextRequest,
//     { params }: { params: Promise<{ id: string }> }
//   )
//
// IMPORTANT: In Next.js 15, `params` is a Promise — you must
// `await` it before accessing properties.  This changed from 14.x
// where params was a plain object.  This catches many developers off
// guard when migrating.
//
// WHY THE PARAMS CHANGE?
// ──────────────────────
// Next.js 15 made params async to support Partial Pre-Rendering (PPR)
// and to ensure dynamic data is always properly awaited in the render
// pipeline.  The same change applies to searchParams in page.tsx.
//
// generateStaticParams (for SSG)
// ───────────────────────────────
// If you export `generateStaticParams` from this file, Next.js will
// pre-render a static HTML page for each returned id at build time.
// Example:
//
//   export async function generateStaticParams() {
//     return countries.map((c) => ({ id: c.id }))
//   }
//
// This is the App Router equivalent of `getStaticPaths`.
// The resulting pages are served as static files — zero server cost.
// Good for data that rarely changes (e.g., country list).
//
// revalidatePath / revalidateTag
// ───────────────────────────────
// After a mutation (PUT/DELETE/PATCH) you should invalidate any
// cached pages that display this data:
//
//   import { revalidatePath } from 'next/cache'
//   revalidatePath('/countries')          // revalidate a path
//   revalidatePath(`/countries/${id}`)    // revalidate a specific page
//   revalidateTag('countries')            // revalidate by cache tag
//
// This forces Next.js to regenerate those pages on the next request
// (ISR-style), ensuring stale data is not shown to users.
//
// STATUS CODE GUIDE
// ──────────────────
// 200 OK           — successful GET / PUT / PATCH
// 201 Created      — successful POST (resource created)
// 204 No Content   — successful DELETE (nothing to return)
// 400 Bad Request  — malformed request
// 404 Not Found    — resource doesn't exist
// 422 Unprocessable— validation errors
// 500 Server Error — unexpected crash
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { countries } from '@/data/countries'
import type { Country } from '@/types'
// In production you would also import: revalidatePath from 'next/cache'

// Type for the second argument to all handlers in a dynamic route.
// Defining it once avoids repetition across GET/PUT/DELETE/PATCH.
type RouteContext = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────
// GET /api/countries/[id]
// ─────────────────────────────────────────
//
// Pattern: look up the resource; if missing return 404.
// Returning 404 via NextResponse.json gives a JSON error body, which
// is friendlier for API consumers than a plain HTML 404 page.
// ─────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteContext) {
  // Await params before destructuring — required in Next.js 15.
  const { id } = await params

  const country = countries.find((c) => c.id === id)

  if (!country) {
    // 404 Not Found — the resource does not exist.
    return NextResponse.json(
      { error: `Country with id "${id}" not found` },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: country }, { status: 200 })
}

// ─────────────────────────────────────────
// PUT /api/countries/[id]
// Full replacement of the resource.
// ─────────────────────────────────────────
//
// HTTP PUT semantics:
//   • NOT safe        – modifies server state
//   • Idempotent      – calling it twice with the same body produces
//                       the same result (contrast with POST)
//   • Full replacement – the client sends the ENTIRE updated object.
//                       Fields omitted from the body are considered
//                       deleted/null.  Use PATCH for partial updates.
//
// In a real app: validate body, update DB, call revalidatePath().
// ─────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = countries.find((c) => c.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Country with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<Country>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Mock full-replace: merge provided fields over existing record.
  // Field names match the Country interface from @/types.
  // In a real DB you'd do: UPDATE countries SET ... WHERE id = ?
  const updated: Country = {
    id: existing.id,                               // id is immutable
    name: body.name ?? existing.name,
    shortName: body.shortName ?? existing.shortName,
    flag: body.flag ?? existing.flag,
    description: body.description ?? existing.description,
    background: body.background ?? existing.background,
    established: body.established ?? existing.established,
    worldCupsWon: body.worldCupsWon ?? existing.worldCupsWon,
    board: body.board ?? existing.board,
    coach: body.coach ?? existing.coach,
    captain: body.captain ?? existing.captain,
    famousPlayers: body.famousPlayers ?? existing.famousPlayers,
  }

  // In production: revalidatePath(`/countries/${id}`) after DB write.

  return NextResponse.json(
    { data: updated, message: 'Country updated (mock)' },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// DELETE /api/countries/[id]
// ─────────────────────────────────────────
//
// HTTP DELETE semantics:
//   • NOT safe   – removes server state
//   • Idempotent – deleting an already-deleted resource should still
//                  return 204 (or 404 if you prefer strictness)
//   • 204 No Content is the canonical success status for DELETE —
//     the resource is gone, there is nothing to return in the body.
//     Do NOT return a body with 204 (it is technically invalid).
// ─────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = countries.find((c) => c.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Country with id "${id}" not found` },
      { status: 404 }
    )
  }

  // In production:
  //   await db.country.delete({ where: { id } })
  //   revalidatePath('/countries')

  // 204 No Content — body must be empty.
  return new NextResponse(null, { status: 204 })
}

// ─────────────────────────────────────────
// PATCH /api/countries/[id]
// Partial update — only fields provided in body are changed.
// ─────────────────────────────────────────
//
// HTTP PATCH semantics:
//   • NOT safe         – modifies server state
//   • NOT guaranteed idempotent (though often is in practice)
//   • Partial update   – only the fields in the request body are
//                        updated; everything else stays unchanged.
//                        This is the key difference from PUT.
//
// PATCH vs PUT interview question:
//   PUT  = "replace the entire resource with what I send"
//   PATCH= "apply these specific changes to the resource"
//   Example: PATCH { name: "New Name" } leaves flag/board/captain intact.
//            PUT  { name: "New Name" } would null-out all other fields.
// ─────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = countries.find((c) => c.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Country with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<Country>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Partial merge: spread existing then override only supplied fields.
  // In SQL: UPDATE countries SET <only provided columns> WHERE id = ?
  const patched: Country = { ...existing, ...body, id: existing.id }

  // In production: revalidatePath(`/countries/${id}`)

  return NextResponse.json(
    { data: patched, message: 'Country partially updated (mock)' },
    { status: 200 }
  )
}
