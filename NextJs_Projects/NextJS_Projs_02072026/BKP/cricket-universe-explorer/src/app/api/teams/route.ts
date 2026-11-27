// ============================================================
// API ROUTE: /api/teams
// FILE: src/app/api/teams/route.ts
// ============================================================
//
// PAGINATION PATTERNS
// ────────────────────
// Real APIs rarely return all records in one response.
// Common pagination strategies:
//
//   Offset / limit:
//     GET /api/teams?page=2&limit=10
//     Simple; works poorly on large datasets (expensive OFFSET queries)
//
//   Cursor-based:
//     GET /api/teams?cursor=<last-seen-id>&limit=10
//     Efficient for large tables; consistent even as data changes.
//     Used by most modern APIs (Twitter/X, Stripe, GitHub).
//
//   Keyset pagination:
//     GET /api/teams?afterId=t5&limit=5
//     Similar to cursor; uses a column value rather than an opaque token.
//
// For this learning demo, we return all records.  In production, always
// paginate collections to avoid memory/bandwidth issues.
//
// FILTERING MULTIPLE PARAMS
// ──────────────────────────
// You can combine multiple query params for compound filtering:
//   GET /api/teams?leagueId=l1&search=mumbai
//
// Build a filter chain: start with the full array, then progressively
// narrow it — readable and easy to extend.
//
// SORTING
// ────────
// GET /api/teams?sort=name&order=asc
// Process with: teams.sort((a, b) => a.name.localeCompare(b.name))
// Validate the sort field against an allowlist to prevent injection.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { teams } from '@/data/teams'
import type { Team } from '@/types'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────
// GET /api/teams
// Optional query param: ?leagueId=<string>
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const leagueId = searchParams.get('leagueId')?.trim()

  // Start with all teams, then filter if a leagueId was provided.
  let result: Team[] = teams

  if (leagueId) {
    result = result.filter((t) => t.leagueId === leagueId)
  }

  return NextResponse.json(
    { data: result, total: result.length },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// POST /api/teams
// Body: Partial<Team>
// ─────────────────────────────────────────
//
// OPTIMISTIC UPDATES (frontend pattern)
// ───────────────────────────────────────
// When you POST to create a team, the UI can immediately show the
// new team (with a temporary local id) before the server responds.
// Once the server returns the real id, the UI reconciles.
// This pattern (optimistic UI) requires the server to return the
// created resource with its authoritative id — hence we return 201
// with the full created object.
export async function POST(request: NextRequest) {
  let body: Partial<Team>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.leagueId) {
    return NextResponse.json(
      { error: 'name and leagueId are required' },
      { status: 422 }
    )
  }

  // Field names match the Team interface from @/types.
  const newTeam: Team = {
    id: `t${Date.now()}`,
    name: body.name,
    leagueId: body.leagueId,
    captain: body.captain ?? '',
    coach: body.coach ?? '',
    homeGround: body.homeGround ?? '',
    titles: body.titles ?? 0,
    logo: body.logo ?? '',
    description: body.description ?? '',
  }

  return NextResponse.json(
    { data: newTeam, message: 'Team created (mock)' },
    {
      status: 201,
      headers: { Location: `/api/teams/${newTeam.id}` },
    }
  )
}
