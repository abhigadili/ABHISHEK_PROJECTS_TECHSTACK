import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { searchCricketersDB } from '@/lib/queries'
import type { Cricketer, PlayerRole } from '@/types'

export const dynamic = 'force-dynamic'

const VALID_ROLES: PlayerRole[] = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper-Batsman', 'Wicketkeeper']

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const teamId = searchParams.get('teamId')?.trim()
  const roleParam = searchParams.get('role')?.trim()

  if (roleParam && !VALID_ROLES.includes(roleParam as PlayerRole)) {
    return NextResponse.json(
      { error: `Invalid role "${roleParam}". Must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  const result = await searchCricketersDB(teamId ?? undefined, roleParam ?? undefined)
  return NextResponse.json({ data: result, total: result.length }, { status: 200 })
}

export async function POST(request: NextRequest) {
  let body: Partial<Cricketer>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.name || !body.teamId || !body.role) {
    return NextResponse.json({ error: 'name, teamId, and role are required' }, { status: 422 })
  }

  if (!VALID_ROLES.includes(body.role as PlayerRole)) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 422 })
  }

  const id = body.id || `${body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${body.teamId}`

  try {
    await pool.query(
      `INSERT INTO cricketers (id, team_id, name, country, role, batting_style, bowling_style, age, matches, runs, wickets, description, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.teamId, body.name, body.country ?? 'Unknown',
       body.role, body.battingStyle ?? 'Right-handed', body.bowlingStyle ?? '',
       body.age ?? 0, body.matches ?? 0, body.runs ?? 0, body.wickets ?? 0,
       body.description ?? '', body.image ?? '']
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('cricketers', 'default')

  const newCricketer: Cricketer = {
    id, teamId: body.teamId, name: body.name,
    country: body.country ?? 'Unknown', role: body.role,
    battingStyle: body.battingStyle ?? 'Right-handed',
    bowlingStyle: body.bowlingStyle ?? '',
    age: body.age ?? 0, matches: body.matches ?? 0,
    runs: body.runs ?? 0, wickets: body.wickets ?? 0,
    description: body.description ?? '', image: body.image ?? '',
  }

  return NextResponse.json(
    { data: newCricketer, message: 'Cricketer created' },
    { status: 201, headers: { Location: `/api/cricketers/${id}` } }
  )
}
