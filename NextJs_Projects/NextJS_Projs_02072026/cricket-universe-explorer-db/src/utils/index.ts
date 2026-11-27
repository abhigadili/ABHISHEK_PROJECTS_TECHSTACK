// Re-export all DB-backed query functions so existing import paths continue to work.
// All functions are now async and backed by MySQL instead of static mock data.

export {
  getAllCountries,
  getCountryById,
  searchCountries,
  getAllLeagues,
  getLeagueById,
  getLeaguesByCountry,
  searchLeagues,
  getAllTeams,
  getTeamById,
  getTeamsByLeague,
  searchTeams,
  getAllCricketers,
  getCricketerById,
  getCricketersByTeam,
  searchCricketersDB as searchCricketers,
} from '@/lib/queries'

// Retained utility helpers (pure functions — no DB needed)

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}
