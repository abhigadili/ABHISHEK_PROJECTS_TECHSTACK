// ============================================================
// API ROUTE: /api/cricketers
// FILE: src/app/api/cricketers/route.ts
// ============================================================
//
// MULTI-PARAM FILTERING
// ──────────────────────
// This route supports two independent query params:
//   ?teamId=<string>  — filter by team
//   ?role=<string>    — filter by playing role
//
// They can be used individually or together for compound filtering:
//   /api/cricketers?teamId=t1              → all MI players
//   /api/cricketers?role=Bowler            → all bowlers across teams
//   /api/cricketers?teamId=t1&role=Bowler  → MI bowlers only
//
// Building a composable filter chain:
//   let result = cricketers
//   if (teamId) result = result.filter(c => c.teamId === teamId)
//   if (role)   result = result.filter(c => c.role === role)
//   // Each filter step narrows the result — easy to add more params.
//
// TYPE-SAFE QUERY PARAMS
// ───────────────────────
// searchParams.get() always returns string | null.
// When you have enum-typed fields (like CricketRole), validate the
// param against the allowed values before using it:
//
//   const VALID_ROLES: CricketRole[] = ['Batsman', 'Bowler', ...]
//   const role = searchParams.get('role')
//   if (role && !VALID_ROLES.includes(role as CricketRole)) {
//     return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
//   }
//
// REQUEST BODY SIZE LIMITS
// ─────────────────────────
// Next.js route handlers accept request bodies up to 4 MB by default.
// To change the limit, use the segment config:
//
//   export const maxDuration = 60   // max execution time in seconds (Vercel)
//
// For large file uploads, use a streaming approach or a service like
// Vercel Blob, Cloudflare R2, or AWS S3 with presigned URLs.
//
// LOGGING AND OBSERVABILITY
// ──────────────────────────
// In production, log requests/errors to an observability platform:
//   • Vercel Analytics (built-in)
//   • Sentry (errors)
//   • Datadog / New Relic (APM)
//   • Custom: console.log in server components writes to Vercel logs
//
// Never log sensitive data (passwords, tokens, PII) even on the server.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { cricketers } from '@/data/cricketers'
import type { Cricketer, PlayerRole } from '@/types'

export const dynamic = 'force-dynamic'

// Allowlist for PlayerRole (from @/types) — used for query param validation.
// Keeping this as a runtime array (not just the TS type) allows us to check
// the string value at runtime since TypeScript types are erased after compile.
const VALID_ROLES: PlayerRole[] = [
  'Batsman',
  'Bowler',
  'All-rounder',
  'Wicketkeeper-Batsman',
  'Wicketkeeper',
]

// ─────────────────────────────────────────
// GET /api/cricketers
// Optional query params: ?teamId=<string> and/or ?role=<string>
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const teamId = searchParams.get('teamId')?.trim()
  const roleParam = searchParams.get('role')?.trim()

  // Validate role against the enum allowlist before using it.
  if (roleParam && !VALID_ROLES.includes(roleParam as PlayerRole)) {
    return NextResponse.json(
      {
        error: `Invalid role "${roleParam}". Must be one of: ${VALID_ROLES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  // Composable filter chain — each step narrows the dataset.
  let result: Cricketer[] = cricketers

  if (teamId) {
    result = result.filter((c) => c.teamId === teamId)
  }

  if (roleParam) {
    result = result.filter((c) => c.role === (roleParam as PlayerRole))
  }

  return NextResponse.json(
    { data: result, total: result.length },
    { status: 200 }
  )
}

// ─────────────────────────────────────────
// POST /api/cricketers
// Body: Partial<Cricketer>
// ─────────────────────────────────────────
//
// NESTED RESOURCE CREATION ALTERNATIVE
// ──────────────────────────────────────
// You could also expose this via:
//   POST /api/teams/[id]/cricketers
// That URL makes the team-player relationship explicit and
// automatically scopes the teamId from the URL (no need to pass it
// in the body).  The flat /api/cricketers POST works fine too — just
// requires the client to send teamId in the body.
export async function POST(request: NextRequest) {
  let body: Partial<Cricketer>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.teamId || !body.role) {
    return NextResponse.json(
      { error: 'name, teamId, and role are required' },
      { status: 422 }
    )
  }

  // Validate role on the way in as well.
  if (!VALID_ROLES.includes(body.role as PlayerRole)) {
    return NextResponse.json(
      { error: `role must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 422 }
    )
  }

  // Field names match the Cricketer interface from @/types.
  const newCricketer: Cricketer = {
    id: `p${Date.now()}`,
    name: body.name,
    teamId: body.teamId,
    role: body.role,
    country: body.country ?? 'Unknown',
    battingStyle: body.battingStyle ?? 'Right-handed',
    bowlingStyle: body.bowlingStyle ?? '',
    age: body.age ?? 0,
    matches: body.matches ?? 0,
    runs: body.runs ?? 0,
    wickets: body.wickets ?? 0,
    description: body.description ?? '',
    image: body.image ?? '',
  }

  return NextResponse.json(
    { data: newCricketer, message: 'Cricketer created (mock)' },
    {
      status: 201,
      headers: { Location: `/api/cricketers/${newCricketer.id}` },
    }
  )
}
