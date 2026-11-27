import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { getTeamById } from '@/lib/queries'
import type { Team } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const team = await getTeamById(id)
  if (!team) {
    return NextResponse.json({ error: `Team "${id}" not found` }, { status: 404 })
  }
  return NextResponse.json({ data: team }, { status: 200 })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getTeamById(id)
  if (!existing) {
    return NextResponse.json({ error: `Team "${id}" not found` }, { status: 404 })
  }

  let body: Partial<Team>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const updated: Team = {
    id: existing.id,
    leagueId: body.leagueId ?? existing.leagueId,
    name: body.name ?? existing.name,
    captain: body.captain ?? existing.captain,
    coach: body.coach ?? existing.coach,
    homeGround: body.homeGround ?? existing.homeGround,
    titles: body.titles ?? existing.titles,
    logo: body.logo ?? existing.logo,
    description: body.description ?? existing.description,
  }

  try {
    await pool.query(
      `UPDATE teams SET league_id=?, name=?, captain=?, coach=?, home_ground=?, titles=?, logo=?, description=?, updated_at=NOW()
       WHERE id=?`,
      [updated.leagueId, updated.name, updated.captain, updated.coach, updated.homeGround, updated.titles, updated.logo, updated.description, id]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('teams', 'default')
  return NextResponse.json({ data: updated, message: 'Team updated' }, { status: 200 })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getTeamById(id)
  if (!existing) {
    return NextResponse.json({ error: `Team "${id}" not found` }, { status: 404 })
  }

  try {
    await pool.query('DELETE FROM teams WHERE id = ?', [id])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('teams', 'default')
  revalidateTag('cricketers', 'default')
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getTeamById(id)
  if (!existing) {
    return NextResponse.json({ error: `Team "${id}" not found` }, { status: 404 })
  }

  let body: Partial<Team>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const patched: Team = { ...existing, ...body, id: existing.id }

  try {
    await pool.query(
      `UPDATE teams SET league_id=?, name=?, captain=?, coach=?, home_ground=?, titles=?, logo=?, description=?, updated_at=NOW()
       WHERE id=?`,
      [patched.leagueId, patched.name, patched.captain, patched.coach, patched.homeGround, patched.titles, patched.logo, patched.description, id]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('teams', 'default')
  return NextResponse.json({ data: patched, message: 'Team updated' }, { status: 200 })
}
