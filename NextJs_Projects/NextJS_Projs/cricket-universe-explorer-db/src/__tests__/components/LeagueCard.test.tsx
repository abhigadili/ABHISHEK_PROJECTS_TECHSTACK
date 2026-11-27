import { render, screen } from '@testing-library/react'
import LeagueCard from '@/components/ui/LeagueCard'
import type { League } from '@/types'

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

const mockLeague: League = {
  id: 'ipl',
  countryId: 'ind',
  name: 'Indian Premier League',
  description:
    'The Indian Premier League is a professional Twenty20 cricket league in India, ' +
    'contested during April to June each year. It is the most attended cricket league ' +
    'in the world and ranks sixth among all sports leagues worldwide.',
  established: 2008,
  format: 'T20',
  trophy: 'IPL Trophy',
  image: '/images/leagues/ipl.jpg',
}

describe('LeagueCard', () => {
  it('renders league name', () => {
    render(<LeagueCard league={mockLeague} />)
    expect(screen.getByText('Indian Premier League')).toBeInTheDocument()
  })

  it('renders format badge', () => {
    render(<LeagueCard league={mockLeague} />)
    expect(screen.getByText('T20')).toBeInTheDocument()
  })

  it('applies emerald badge classes for T20 format', () => {
    render(<LeagueCard league={mockLeague} />)
    const badge = screen.getByText('T20')
    expect(badge.className).toContain('bg-emerald-900')
    expect(badge.className).toContain('text-emerald-300')
  })

  it('applies blue badge classes for Test format', () => {
    const testLeague: League = { ...mockLeague, id: 'test-league', format: 'Test', name: 'Test Series' }
    render(<LeagueCard league={testLeague} />)
    const badge = screen.getByText('Test')
    expect(badge.className).toContain('bg-blue-900')
    expect(badge.className).toContain('text-blue-300')
  })

  it('truncates long description to 100 characters', () => {
    render(<LeagueCard league={mockLeague} />)
    // The component truncates to 100 chars and appends '…'
    const description = screen.getByText(/The Indian Premier League is a professional/i)
    expect(description.textContent).toHaveLength(101) // 100 chars + '…'
    expect(description.textContent).toMatch(/…$/)
  })

  it('does not truncate short description', () => {
    const shortDesc = 'A short description.'
    const leagueWithShortDesc: League = { ...mockLeague, description: shortDesc }
    render(<LeagueCard league={leagueWithShortDesc} />)
    expect(screen.getByText(shortDesc)).toBeInTheDocument()
  })

  it('renders establishment year', () => {
    render(<LeagueCard league={mockLeague} />)
    expect(screen.getByText('2008')).toBeInTheDocument()
  })

  it('has a link to the league detail page', () => {
    render(<LeagueCard league={mockLeague} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('ipl'))
    expect(link).toHaveAttribute('href', expect.stringContaining('ind'))
  })
})
