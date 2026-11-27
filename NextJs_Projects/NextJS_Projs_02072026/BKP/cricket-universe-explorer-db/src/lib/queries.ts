import { unstable_cache } from 'next/cache'
import pool from './db'
import type { Country, League, Team, Cricketer, CricketFormat, PlayerRole, BattingStyle } from '@/types'

// ── Row types (DB snake_case → TS camelCase) ─────────────────────────────────

type CountryRow = {
  id: string; name: string; short_name: string; flag: string
  description: string; background: string; established: number
  world_cups_won: number; board: string; coach: string; captain: string
  famous_players: string | string[]
}

type LeagueRow = {
  id: string; country_id: string; name: string; description: string
  established: number; format: string; trophy: string; image: string
}

type TeamRow = {
  id: string; league_id: string; name: string; captain: string
  coach: string; home_ground: string; titles: number; logo: string; description: string
}

type CricketerRow = {
  id: string; team_id: string; name: string; country: string; role: string
  batting_style: string; bowling_style: string; age: number; matches: number
  runs: number; wickets: number; description: string; image: string
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapCountry(row: CountryRow): Country {
  let famousPlayers: string[] = []
  if (typeof row.famous_players === 'string') {
    try { famousPlayers = JSON.parse(row.famous_players) } catch { famousPlayers = [] }
  } else if (Array.isArray(row.famous_players)) {
    famousPlayers = row.famous_players
  }
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    flag: row.flag,
    description: row.description,
    background: row.background ?? '',
    established: row.established,
    worldCupsWon: row.world_cups_won,
    board: row.board,
    coach: row.coach,
    captain: row.captain,
    famousPlayers,
  }
}

function mapLeague(row: LeagueRow): League {
  return {
    id: row.id,
    countryId: row.country_id,
    name: row.name,
    description: row.description,
    established: row.established,
    format: row.format as CricketFormat,
    trophy: row.trophy,
    image: row.image ?? '',
  }
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    captain: row.captain,
    coach: row.coach,
    homeGround: row.home_ground,
    titles: row.titles,
    logo: row.logo ?? '',
    description: row.description,
  }
}

function mapCricketer(row: CricketerRow): Cricketer {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    country: row.country,
    role: row.role as PlayerRole,
    battingStyle: row.batting_style as BattingStyle,
    bowlingStyle: row.bowling_style ?? '',
    age: row.age,
    matches: row.matches,
    runs: row.runs,
    wickets: row.wickets,
    description: row.description,
    image: row.image ?? '',
  }
}

// ── Countries ────────────────────────────────────────────────────────────────

export const getAllCountries = unstable_cache(
  async (): Promise<Country[]> => {
    const [rows] = await pool.query('SELECT * FROM countries ORDER BY name')
    return (rows as CountryRow[]).map(mapCountry)
  },
  ['countries-all'],
  { revalidate: 300, tags: ['countries'] }
)

export const getCountryById = unstable_cache(
  async (id: string): Promise<Country | undefined> => {
    const [rows] = await pool.query('SELECT * FROM countries WHERE id = ?', [id])
    const arr = rows as CountryRow[]
    return arr.length > 0 ? mapCountry(arr[0]) : undefined
  },
  ['country-by-id'],
  { revalidate: 300, tags: ['countries'] }
)

export async function searchCountries(search: string): Promise<Country[]> {
  const [rows] = await pool.query(
    'SELECT * FROM countries WHERE LOWER(name) LIKE ? ORDER BY name',
    [`%${search.toLowerCase()}%`]
  )
  return (rows as CountryRow[]).map(mapCountry)
}

// ── Leagues ──────────────────────────────────────────────────────────────────

export const getAllLeagues = unstable_cache(
  async (): Promise<League[]> => {
    const [rows] = await pool.query('SELECT * FROM leagues ORDER BY name')
    return (rows as LeagueRow[]).map(mapLeague)
  },
  ['leagues-all'],
  { revalidate: 300, tags: ['leagues'] }
)

export const getLeagueById = unstable_cache(
  async (id: string): Promise<League | undefined> => {
    const [rows] = await pool.query('SELECT * FROM leagues WHERE id = ?', [id])
    const arr = rows as LeagueRow[]
    return arr.length > 0 ? mapLeague(arr[0]) : undefined
  },
  ['league-by-id'],
  { revalidate: 300, tags: ['leagues'] }
)

export const getLeaguesByCountry = unstable_cache(
  async (countryId: string): Promise<League[]> => {
    const [rows] = await pool.query(
      'SELECT * FROM leagues WHERE country_id = ? ORDER BY name',
      [countryId]
    )
    return (rows as LeagueRow[]).map(mapLeague)
  },
  ['leagues-by-country'],
  { revalidate: 300, tags: ['leagues'] }
)

export async function searchLeagues(countryId?: string, search?: string): Promise<League[]> {
  let sql = 'SELECT * FROM leagues WHERE 1=1'
  const params: string[] = []
  if (countryId) { sql += ' AND country_id = ?'; params.push(countryId) }
  if (search) { sql += ' AND LOWER(name) LIKE ?'; params.push(`%${search.toLowerCase()}%`) }
  sql += ' ORDER BY name'
  const [rows] = await pool.query(sql, params)
  return (rows as LeagueRow[]).map(mapLeague)
}

// ── Teams ────────────────────────────────────────────────────────────────────

export const getAllTeams = unstable_cache(
  async (): Promise<Team[]> => {
    const [rows] = await pool.query('SELECT * FROM teams ORDER BY name')
    return (rows as TeamRow[]).map(mapTeam)
  },
  ['teams-all'],
  { revalidate: 300, tags: ['teams'] }
)

export const getTeamById = unstable_cache(
  async (id: string): Promise<Team | undefined> => {
    const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [id])
    const arr = rows as TeamRow[]
    return arr.length > 0 ? mapTeam(arr[0]) : undefined
  },
  ['team-by-id'],
  { revalidate: 300, tags: ['teams'] }
)

export const getTeamsByLeague = unstable_cache(
  async (leagueId: string): Promise<Team[]> => {
    const [rows] = await pool.query(
      'SELECT * FROM teams WHERE league_id = ? ORDER BY name',
      [leagueId]
    )
    return (rows as TeamRow[]).map(mapTeam)
  },
  ['teams-by-league'],
  { revalidate: 300, tags: ['teams'] }
)

export async function searchTeams(leagueId?: string): Promise<Team[]> {
  let sql = 'SELECT * FROM teams WHERE 1=1'
  const params: string[] = []
  if (leagueId) { sql += ' AND league_id = ?'; params.push(leagueId) }
  sql += ' ORDER BY name'
  const [rows] = await pool.query(sql, params)
  return (rows as TeamRow[]).map(mapTeam)
}

// ── Cricketers ───────────────────────────────────────────────────────────────

export const getAllCricketers = unstable_cache(
  async (): Promise<Cricketer[]> => {
    const [rows] = await pool.query('SELECT * FROM cricketers ORDER BY name')
    return (rows as CricketerRow[]).map(mapCricketer)
  },
  ['cricketers-all'],
  { revalidate: 300, tags: ['cricketers'] }
)

export const getCricketerById = unstable_cache(
  async (id: string): Promise<Cricketer | undefined> => {
    const [rows] = await pool.query('SELECT * FROM cricketers WHERE id = ?', [id])
    const arr = rows as CricketerRow[]
    return arr.length > 0 ? mapCricketer(arr[0]) : undefined
  },
  ['cricketer-by-id'],
  { revalidate: 300, tags: ['cricketers'] }
)

export const getCricketersByTeam = unstable_cache(
  async (teamId: string): Promise<Cricketer[]> => {
    const [rows] = await pool.query(
      'SELECT * FROM cricketers WHERE team_id = ? ORDER BY name',
      [teamId]
    )
    return (rows as CricketerRow[]).map(mapCricketer)
  },
  ['cricketers-by-team'],
  { revalidate: 300, tags: ['cricketers'] }
)

export async function searchCricketersDB(teamId?: string, role?: string): Promise<Cricketer[]> {
  let sql = 'SELECT * FROM cricketers WHERE 1=1'
  const params: string[] = []
  if (teamId) { sql += ' AND team_id = ?'; params.push(teamId) }
  if (role) { sql += ' AND role = ?'; params.push(role) }
  sql += ' ORDER BY name'
  const [rows] = await pool.query(sql, params)
  return (rows as CricketerRow[]).map(mapCricketer)
}
