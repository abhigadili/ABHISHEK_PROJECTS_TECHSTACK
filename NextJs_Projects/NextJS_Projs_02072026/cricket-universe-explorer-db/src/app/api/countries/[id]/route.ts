import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { getCountryById } from '@/lib/queries'
import type { Country } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const country = await getCountryById(id)
  if (!country) {
    return NextResponse.json({ error: `Country "${id}" not found` }, { status: 404 })
  }
  return NextResponse.json({ data: country }, { status: 200 })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getCountryById(id)
  if (!existing) {
    return NextResponse.json({ error: `Country "${id}" not found` }, { status: 404 })
  }

  let body: Partial<Country>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const updated: Country = {
    id: existing.id,
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

  try {
    await pool.query(
      `UPDATE countries SET name=?, short_name=?, flag=?, description=?, background=?,
       established=?, world_cups_won=?, board=?, coach=?, captain=?, famous_players=?, updated_at=NOW()
       WHERE id=?`,
      [
        updated.name, updated.shortName, updated.flag, updated.description, updated.background,
        updated.established, updated.worldCupsWon, updated.board, updated.coach, updated.captain,
        JSON.stringify(updated.famousPlayers), id,
      ]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('countries', 'default')
  return NextResponse.json({ data: updated, message: 'Country updated' }, { status: 200 })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getCountryById(id)
  if (!existing) {
    return NextResponse.json({ error: `Country "${id}" not found` }, { status: 404 })
  }

  try {
    await pool.query('DELETE FROM countries WHERE id = ?', [id])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('countries', 'default')
  revalidateTag('leagues', 'default')
  revalidateTag('teams', 'default')
  revalidateTag('cricketers', 'default')
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getCountryById(id)
  if (!existing) {
    return NextResponse.json({ error: `Country "${id}" not found` }, { status: 404 })
  }

  let body: Partial<Country>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const patched: Country = { ...existing, ...body, id: existing.id }

  try {
    await pool.query(
      `UPDATE countries SET name=?, short_name=?, flag=?, description=?, background=?,
       established=?, world_cups_won=?, board=?, coach=?, captain=?, famous_players=?, updated_at=NOW()
       WHERE id=?`,
      [
        patched.name, patched.shortName, patched.flag, patched.description, patched.background,
        patched.established, patched.worldCupsWon, patched.board, patched.coach, patched.captain,
        JSON.stringify(patched.famousPlayers), id,
      ]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('countries', 'default')
  return NextResponse.json({ data: patched, message: 'Country updated' }, { status: 200 })
}
