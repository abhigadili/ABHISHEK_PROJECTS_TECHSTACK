import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { searchTeams } from '@/lib/queries'
import type { Team } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const leagueId = searchParams.get('leagueId')?.trim()

  const result = await searchTeams(leagueId ?? undefined)
  return NextResponse.json({ data: result, total: result.length }, { status: 200 })
}

export async function POST(request: NextRequest) {
  let body: Partial<Team>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.name || !body.leagueId) {
    return NextResponse.json({ error: 'name and leagueId are required' }, { status: 422 })
  }

  const id = body.id || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  try {
    await pool.query(
      `INSERT INTO teams (id, league_id, name, captain, coach, home_ground, titles, logo, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.leagueId, body.name, body.captain ?? '', body.coach ?? '',
       body.homeGround ?? '', body.titles ?? 0, body.logo ?? '', body.description ?? '']
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('teams', 'default')

  const newTeam: Team = {
    id, leagueId: body.leagueId, name: body.name,
    captain: body.captain ?? '', coach: body.coach ?? '',
    homeGround: body.homeGround ?? '', titles: body.titles ?? 0,
    logo: body.logo ?? '', description: body.description ?? '',
  }

  return NextResponse.json(
    { data: newTeam, message: 'Team created' },
    { status: 201, headers: { Location: `/api/teams/${id}` } }
  )
}
