import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { getLeagueById } from '@/lib/queries'
import type { League } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const league = await getLeagueById(id)
  if (!league) {
    return NextResponse.json({ error: `League "${id}" not found` }, { status: 404 })
  }
  return NextResponse.json({ data: league }, { status: 200 })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getLeagueById(id)
  if (!existing) {
    return NextResponse.json({ error: `League "${id}" not found` }, { status: 404 })
  }

  let body: Partial<League>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const updated: League = {
    id: existing.id,
    countryId: body.countryId ?? existing.countryId,
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    established: body.established ?? existing.established,
    format: body.format ?? existing.format,
    trophy: body.trophy ?? existing.trophy,
    image: body.image ?? existing.image,
  }

  try {
    await pool.query(
      `UPDATE leagues SET country_id=?, name=?, description=?, established=?, format=?, trophy=?, image=?, updated_at=NOW()
       WHERE id=?`,
      [updated.countryId, updated.name, updated.description, updated.established, updated.format, updated.trophy, updated.image, id]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('leagues', 'default')
  return NextResponse.json({ data: updated, message: 'League updated' }, { status: 200 })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getLeagueById(id)
  if (!existing) {
    return NextResponse.json({ error: `League "${id}" not found` }, { status: 404 })
  }

  try {
    await pool.query('DELETE FROM leagues WHERE id = ?', [id])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('leagues', 'default')
  revalidateTag('teams', 'default')
  revalidateTag('cricketers', 'default')
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const existing = await getLeagueById(id)
  if (!existing) {
    return NextResponse.json({ error: `League "${id}" not found` }, { status: 404 })
  }

  let body: Partial<League>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const patched: League = { ...existing, ...body, id: existing.id }

  try {
    await pool.query(
      `UPDATE leagues SET country_id=?, name=?, description=?, established=?, format=?, trophy=?, image=?, updated_at=NOW()
       WHERE id=?`,
      [patched.countryId, patched.name, patched.description, patched.established, patched.format, patched.trophy, patched.image, id]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('leagues', 'default')
  return NextResponse.json({ data: patched, message: 'League updated' }, { status: 200 })
}
