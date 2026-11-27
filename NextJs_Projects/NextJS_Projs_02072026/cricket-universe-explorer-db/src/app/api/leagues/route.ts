import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { getAllLeagues, searchLeagues } from '@/lib/queries'
import type { League } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const countryId = searchParams.get('countryId')?.trim()
  const search = searchParams.get('search')?.trim()

  const result = await searchLeagues(countryId ?? undefined, search ?? undefined)
  return NextResponse.json({ data: result, total: result.length }, { status: 200 })
}

export async function POST(request: NextRequest) {
  let body: Partial<League>
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  if (!body.name || !body.countryId) {
    return NextResponse.json({ error: 'name and countryId are required' }, { status: 422 })
  }

  const id = body.id || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  try {
    await pool.query(
      `INSERT INTO leagues (id, country_id, name, description, established, format, trophy, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.countryId, body.name,
        body.description ?? '', body.established ?? new Date().getFullYear(),
        body.format ?? 'T20', body.trophy ?? '', body.image ?? '',
      ]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('leagues', 'default')

  const newLeague: League = {
    id, countryId: body.countryId, name: body.name,
    description: body.description ?? '',
    established: body.established ?? new Date().getFullYear(),
    format: body.format ?? 'T20', trophy: body.trophy ?? '', image: body.image ?? '',
  }

  return NextResponse.json(
    { data: newLeague, message: 'League created' },
    { status: 201, headers: { Location: `/api/leagues/${id}` } }
  )
}
