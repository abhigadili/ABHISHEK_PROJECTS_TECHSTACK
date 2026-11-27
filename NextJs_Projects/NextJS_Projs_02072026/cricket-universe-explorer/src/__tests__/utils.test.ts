import {
  formatNumber,
  truncateText,
  getCountryById,
  getAllCountries,
  getLeagueById,
  getLeaguesByCountry,
  getTeamById,
  getCricketerById,
  getTopRunScorers,
  getTopWicketTakers,
  searchCricketers,
} from '@/utils'

// ─── formatNumber ─────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats 1234 as "1,234"', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })

  it('formats 0 as "0"', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats 100 without comma (under 1000)', () => {
    expect(formatNumber(100)).toBe('100')
  })

  it('formats 1000000 as "1,000,000"', () => {
    expect(formatNumber(1_000_000)).toBe('1,000,000')
  })

  it('formats 7263 as "7,263"', () => {
    expect(formatNumber(7263)).toBe('7,263')
  })
})

// ─── truncateText ─────────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('truncates text longer than maxLength', () => {
    const result = truncateText('Hello world', 5)
    expect(result).toBe('Hello…')
  })

  it('does not truncate text shorter than or equal to maxLength', () => {
    expect(truncateText('Hi', 10)).toBe('Hi')
    expect(truncateText('Hello', 5)).toBe('Hello')
  })

  it('appends ellipsis character when truncating', () => {
    const result = truncateText('abcdefgh', 4)
    expect(result).toMatch(/…$/)
  })

  it('returns the original empty string unchanged', () => {
    expect(truncateText('', 10)).toBe('')
  })

  it('handles truncation at exactly maxLength boundary', () => {
    const text = 'Exactly ten!'
    // Length is 12 — truncating at 10 gives 'Exactly te…'
    expect(truncateText(text, 10)).toBe('Exactly te…')
  })
})

// ─── getCountryById ───────────────────────────────────────────────────────────

describe('getCountryById', () => {
  it('returns the India country for id "ind"', () => {
    const country = getCountryById('ind')
    expect(country).toBeDefined()
    expect(country?.id).toBe('ind')
    expect(country?.name).toBe('India')
  })

  it('returns undefined for an invalid / non-existent id', () => {
    const result = getCountryById('xyz-invalid-id')
    expect(result).toBeUndefined()
  })

  it('returns undefined for an empty string id', () => {
    expect(getCountryById('')).toBeUndefined()
  })
})

// ─── getAllCountries ──────────────────────────────────────────────────────────

describe('getAllCountries', () => {
  it('returns an array of countries', () => {
    const all = getAllCountries()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThan(0)
  })

  it('each country has the required fields', () => {
    const all = getAllCountries()
    all.forEach((c) => {
      expect(c).toHaveProperty('id')
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('shortName')
      expect(c).toHaveProperty('board')
    })
  })
})

// ─── getLeagueById ────────────────────────────────────────────────────────────

describe('getLeagueById', () => {
  it('returns undefined for a non-existent league id', () => {
    expect(getLeagueById('no-such-league')).toBeUndefined()
  })

  it('returns the correct league when found', () => {
    const all = getAllCountries()
    // Just verify it returns something for a known league that exists
    // The actual ID depends on the data; we use a dynamic lookup to stay data-agnostic
    const { leagues } = require('@/data/leagues')
    if (leagues.length > 0) {
      const firstLeague = leagues[0]
      const result = getLeagueById(firstLeague.id)
      expect(result).toBeDefined()
      expect(result?.id).toBe(firstLeague.id)
    }
  })
})

// ─── getLeaguesByCountry ──────────────────────────────────────────────────────

describe('getLeaguesByCountry', () => {
  it('returns an array (possibly empty) for any country id', () => {
    const result = getLeaguesByCountry('ind')
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns an empty array for a non-existent country id', () => {
    expect(getLeaguesByCountry('no-such-country')).toEqual([])
  })

  it('all returned leagues belong to the requested country', () => {
    const result = getLeaguesByCountry('ind')
    result.forEach((league) => {
      expect(league.countryId).toBe('ind')
    })
  })
})

// ─── getTeamById ─────────────────────────────────────────────────────────────

describe('getTeamById', () => {
  it('returns undefined for a non-existent team id', () => {
    expect(getTeamById('no-such-team')).toBeUndefined()
  })

  it('returns the correct team when found', () => {
    const { teams } = require('@/data/teams')
    if (teams.length > 0) {
      const firstTeam = teams[0]
      const result = getTeamById(firstTeam.id)
      expect(result).toBeDefined()
      expect(result?.id).toBe(firstTeam.id)
    }
  })
})

// ─── getCricketerById ─────────────────────────────────────────────────────────

describe('getCricketerById', () => {
  it('returns undefined for a non-existent cricketer id', () => {
    expect(getCricketerById('no-such-player')).toBeUndefined()
  })

  it('returns the correct cricketer when found', () => {
    const { cricketers } = require('@/data/cricketers')
    if (cricketers.length > 0) {
      const first = cricketers[0]
      const result = getCricketerById(first.id)
      expect(result).toBeDefined()
      expect(result?.id).toBe(first.id)
    }
  })
})

// ─── getTopRunScorers ─────────────────────────────────────────────────────────

describe('getTopRunScorers', () => {
  it('returns cricketers sorted by runs descending', () => {
    const sorted = getTopRunScorers()
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].runs).toBeGreaterThanOrEqual(sorted[i].runs)
    }
  })

  it('respects the limit parameter', () => {
    const top3 = getTopRunScorers(3)
    expect(top3.length).toBeLessThanOrEqual(3)
  })

  it('does not mutate the original cricketers array', () => {
    const { cricketers } = require('@/data/cricketers')
    const originalFirst = cricketers[0].id
    getTopRunScorers()
    expect(cricketers[0].id).toBe(originalFirst)
  })
})

// ─── getTopWicketTakers ───────────────────────────────────────────────────────

describe('getTopWicketTakers', () => {
  it('returns cricketers sorted by wickets descending', () => {
    const sorted = getTopWicketTakers()
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].wickets).toBeGreaterThanOrEqual(sorted[i].wickets)
    }
  })

  it('respects the limit parameter', () => {
    const top5 = getTopWicketTakers(5)
    expect(top5.length).toBeLessThanOrEqual(5)
  })
})

// ─── searchCricketers ─────────────────────────────────────────────────────────

describe('searchCricketers', () => {
  it('returns an empty array for an empty query', () => {
    expect(searchCricketers('')).toEqual([])
  })

  it('returns an empty array for a whitespace-only query', () => {
    expect(searchCricketers('   ')).toEqual([])
  })

  it('returns matching cricketers by country name', () => {
    const results = searchCricketers('India')
    expect(Array.isArray(results)).toBe(true)
    results.forEach((p) => {
      expect(p.country.toLowerCase()).toContain('india')
    })
  })

  it('is case-insensitive', () => {
    const lower = searchCricketers('india')
    const upper = searchCricketers('INDIA')
    expect(lower.length).toBe(upper.length)
  })

  it('returns empty array for a query with no matches', () => {
    expect(searchCricketers('ZZZNoMatchXXX')).toEqual([])
  })
})
