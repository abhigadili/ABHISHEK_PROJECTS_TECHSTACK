import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { getCricketerById } from '@/lib/queries'
import type { Cricketer } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const cricketer = await getCricketerById(id)
  if (!cricketer) {
    return NextResponse.json({ error: `Cricketer "${id}" not found` }, { status: 404 })
  }
  return NextResponse.json({ data: cricketer }, { status: 200 })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getCricketerById(id)
  if (!existing) {
    return NextResponse.json({ error: `Cricketer "${id}" not found` }, { status: 404 })
  }

  let body: Partial<Cricketer>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const updated: Cricketer = {
    id: existing.id,
    teamId: body.teamId ?? existing.teamId,
    name: body.name ?? existing.name,
    country: body.country ?? existing.country,
    role: body.role ?? existing.role,
    battingStyle: body.battingStyle ?? existing.battingStyle,
    bowlingStyle: body.bowlingStyle ?? existing.bowlingStyle,
    age: body.age ?? existing.age,
    matches: body.matches ?? existing.matches,
    runs: body.runs ?? existing.runs,
    wickets: body.wickets ?? existing.wickets,
    description: body.description ?? existing.description,
    image: body.image ?? existing.image,
  }

  try {
    await pool.query(
      `UPDATE cricketers SET team_id=?, name=?, country=?, role=?, batting_style=?, bowling_style=?,
       age=?, matches=?, runs=?, wickets=?, description=?, image=?, updated_at=NOW()
       WHERE id=?`,
      [updated.teamId, updated.name, updated.country, updated.role, updated.battingStyle,
       updated.bowlingStyle, updated.age, updated.matches, updated.runs, updated.wickets,
       updated.description, updated.image, id]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('cricketers', 'default')
  return NextResponse.json({ data: updated, message: 'Cricketer updated' }, { status: 200 })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getCricketerById(id)
  if (!existing) {
    return NextResponse.json({ error: `Cricketer "${id}" not found` }, { status: 404 })
  }

  try {
    await pool.query('DELETE FROM cricketers WHERE id = ?', [id])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('cricketers', 'default')
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getCricketerById(id)
  if (!existing) {
    return NextResponse.json({ error: `Cricketer "${id}" not found` }, { status: 404 })
  }

  let body: Partial<Cricketer>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const patched: Cricketer = { ...existing, ...body, id: existing.id }

  try {
    await pool.query(
      `UPDATE cricketers SET team_id=?, name=?, country=?, role=?, batting_style=?, bowling_style=?,
       age=?, matches=?, runs=?, wickets=?, description=?, image=?, updated_at=NOW()
       WHERE id=?`,
      [patched.teamId, patched.name, patched.country, patched.role, patched.battingStyle,
       patched.bowlingStyle, patched.age, patched.matches, patched.runs, patched.wickets,
       patched.description, patched.image, id]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('cricketers', 'default')
  return NextResponse.json({ data: patched, message: 'Cricketer updated' }, { status: 200 })
}
