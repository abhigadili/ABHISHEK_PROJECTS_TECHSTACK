// ============================================================
// API ROUTE: /api/teams/[id]
// FILE: src/app/api/teams/[id]/route.ts
// ============================================================
//
// ENRICHED RESPONSES (JOIN PATTERN)
// ───────────────────────────────────
// For a team detail page you typically need the team's league name
// and the parent country.  Instead of making the client do three
// fetches, the API can join the data server-side:
//
//   const team = teams.find(t => t.id === id)
//   const league = leagues.find(l => l.id === team.leagueId)
//   const country = countries.find(c => c.id === league.countryId)
//   return { ...team, league, country }
//
// This is the "Backend for Frontend" (BFF) pattern — the API shapes
// its response specifically for the UI's needs rather than exposing
// raw DB rows.
//
// RATE LIMITING
// ──────────────
// In production, protect mutation endpoints (POST/PUT/DELETE/PATCH)
// with rate limiting.  Options:
//   • Upstash Redis with @upstash/ratelimit  (serverless-friendly)
//   • Vercel Edge Middleware                 (before route handlers run)
//   • next-rate-limit npm package
//
// Pattern in middleware.ts:
//   const { success } = await ratelimit.limit(ip)
//   if (!success) return new NextResponse('Too Many Requests', { status: 429 })
//
// AUTHENTICATION / AUTHORIZATION
// ────────────────────────────────
// Protect write operations by checking a session or JWT:
//
//   import { getServerSession } from 'next-auth'
//   const session = await getServerSession(authOptions)
//   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   if (!session.user.roles.includes('admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
//
// 401 Unauthorized → not authenticated (no/invalid session)
// 403 Forbidden    → authenticated but lacks permission
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { teams } from '@/data/teams'
import type { Team } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

// ─────────────────────────────────────────
// GET /api/teams/[id]
// ─────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const team = teams.find((t) => t.id === id)
  if (!team) {
    return NextResponse.json(
      { error: `Team with id "${id}" not found` },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: team }, { status: 200 })
}

// ─────────────────────────────────────────
// PUT /api/teams/[id]
// Full replace
// ─────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = teams.find((t) => t.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Team with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<Team>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Field names match the Team interface from @/types.
  const updated: Team = {
    id: existing.id,
    name: body.name ?? existing.name,
    leagueId: body.leagueId ?? existing.leagueId,
    captain: body.captain ?? existing.captain,
    coach: body.coach ?? existing.coach,
    homeGround: body.homeGround ?? existing.homeGround,
    titles: body.titles ?? existing.titles,
    logo: body.logo ?? existing.logo,
    description: body.description ?? existing.description,
  }

  return NextResponse.json(
    { data: updated, message: 'Team updated (mock)' },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// DELETE /api/teams/[id]
// ─────────────────────────────────────────
//
// SOFT DELETE PATTERN
// ────────────────────
// Instead of removing the row from the DB, set a deletedAt timestamp:
//   UPDATE teams SET deleted_at = NOW() WHERE id = ?
// Then filter it out in all GET queries:
//   WHERE deleted_at IS NULL
//
// Benefits:
//   • Audit trail (you know when/what was deleted)
//   • Recoverability (you can un-delete)
//   • Referential integrity (foreign keys still resolve)
//
// Return 204 for soft-delete just as you would for hard-delete.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = teams.find((t) => t.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Team with id "${id}" not found` },
      { status: 404 }
    )
  }

  return new NextResponse(null, { status: 204 })
}

// ─────────────────────────────────────────
// PATCH /api/teams/[id]
// Partial update
// ─────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params

  const existing = teams.find((t) => t.id === id)
  if (!existing) {
    return NextResponse.json(
      { error: `Team with id "${id}" not found` },
      { status: 404 }
    )
  }

  let body: Partial<Team>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patched: Team = { ...existing, ...body, id: existing.id }

  return NextResponse.json(
    { data: patched, message: 'Team partially updated (mock)' },
    { status: 200 }
  )
}
