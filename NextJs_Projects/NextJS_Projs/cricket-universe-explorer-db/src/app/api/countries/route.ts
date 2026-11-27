import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import pool from '@/lib/db'
import { getAllCountries, searchCountries } from '@/lib/queries'
import type { Country } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.toLowerCase().trim()

  const result: Country[] = search
    ? await searchCountries(search)
    : await getAllCountries()

  return NextResponse.json({ data: result, total: result.length }, { status: 200 })
}

export async function POST(request: NextRequest) {
  let body: Partial<Country>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.shortName) {
    return NextResponse.json({ error: 'name and shortName are required' }, { status: 422 })
  }

  const id = body.id || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const famousPlayers = JSON.stringify(body.famousPlayers ?? [])

  try {
    await pool.query(
      `INSERT INTO countries (id, name, short_name, flag, description, background, established, world_cups_won, board, coach, captain, famous_players)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.name, body.shortName,
        body.flag ?? '🏳️', body.description ?? '',
        body.background ?? '',
        body.established ?? new Date().getFullYear(),
        body.worldCupsWon ?? 0,
        body.board ?? '', body.coach ?? '', body.captain ?? '',
        famousPlayers,
      ]
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  revalidateTag('countries', 'default')

  const newCountry: Country = {
    id, name: body.name, shortName: body.shortName,
    flag: body.flag ?? '🏳️', description: body.description ?? '',
    background: body.background ?? '',
    established: body.established ?? new Date().getFullYear(),
    worldCupsWon: body.worldCupsWon ?? 0,
    board: body.board ?? '', coach: body.coach ?? '', captain: body.captain ?? '',
    famousPlayers: body.famousPlayers ?? [],
  }

  return NextResponse.json(
    { data: newCountry, message: 'Country created' },
    { status: 201, headers: { Location: `/api/countries/${id}` } }
  )
}
