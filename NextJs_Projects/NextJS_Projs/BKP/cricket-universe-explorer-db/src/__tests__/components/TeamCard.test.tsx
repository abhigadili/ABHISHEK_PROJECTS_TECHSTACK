import { render, screen } from '@testing-library/react'
import TeamCard from '@/components/ui/TeamCard'
import type { Team } from '@/types'

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

const mockTeam: Team = {
  id: 'csk',
  leagueId: 'ipl',
  name: 'Chennai Super Kings',
  captain: 'MS Dhoni',
  coach: 'Stephen Fleming',
  homeGround: 'MA Chidambaram Stadium',
  titles: 5,
  logo: '/images/teams/csk.png',
  description: 'Chennai Super Kings is one of the most successful IPL franchises.',
}

describe('TeamCard', () => {
  it('renders team name', () => {
    render(<TeamCard team={mockTeam} />)
    expect(screen.getByText('Chennai Super Kings')).toBeInTheDocument()
  })

  it('renders captain name', () => {
    render(<TeamCard team={mockTeam} />)
    expect(screen.getByText(/MS Dhoni/i)).toBeInTheDocument()
  })

  it('renders coach name', () => {
    render(<TeamCard team={mockTeam} />)
    expect(screen.getByText(/Stephen Fleming/i)).toBeInTheDocument()
  })

  it('renders home ground', () => {
    render(<TeamCard team={mockTeam} />)
    expect(screen.getByText(/MA Chidambaram Stadium/i)).toBeInTheDocument()
  })

  it('renders title count', () => {
    render(<TeamCard team={mockTeam} />)
    expect(screen.getByText(/5 titles/i)).toBeInTheDocument()
  })

  it('renders "No titles yet" for a team with zero titles', () => {
    const newTeam: Team = { ...mockTeam, id: 'new-team', titles: 0 }
    render(<TeamCard team={newTeam} />)
    expect(screen.getByText('No titles yet')).toBeInTheDocument()
  })

  it('renders singular "title" for a team with exactly 1 title', () => {
    const oneTitle: Team = { ...mockTeam, id: 'one-title', titles: 1 }
    render(<TeamCard team={oneTitle} />)
    expect(screen.getByText(/1 title/i)).toBeInTheDocument()
    // Ensure it is not "1 titles"
    expect(screen.queryByText(/1 titles/i)).not.toBeInTheDocument()
  })

  it('has a link to the team profile page', () => {
    render(<TeamCard team={mockTeam} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('csk'))
  })
})
