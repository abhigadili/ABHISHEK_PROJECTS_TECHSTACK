import { render, screen } from '@testing-library/react'
import CricketerCard from '@/components/ui/CricketerCard'
import type { Cricketer } from '@/types'

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

const mockCricketer: Cricketer = {
  id: 'virat-kohli-rcb',
  teamId: 'rcb',
  name: 'Virat Kohli',
  country: 'India',
  role: 'Batsman',
  battingStyle: 'Right-handed',
  bowlingStyle: '',
  age: 35,
  matches: 237,
  runs: 7263,
  wickets: 4,
  description: 'One of the greatest batsmen in cricket history.',
  image: '/images/players/virat-kohli.jpg',
}

describe('CricketerCard', () => {
  it('renders cricketer name', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    expect(screen.getByText('Virat Kohli')).toBeInTheDocument()
  })

  it('renders country name', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    expect(screen.getByText('India')).toBeInTheDocument()
  })

  it('renders role badge', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    expect(screen.getByText('Batsman')).toBeInTheDocument()
  })

  it('renders matches stat', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    expect(screen.getByText('Matches')).toBeInTheDocument()
    // toLocaleString formats 237 as '237'
    expect(screen.getByText('237')).toBeInTheDocument()
  })

  it('renders runs stat', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    expect(screen.getByText('Runs')).toBeInTheDocument()
    // toLocaleString formats 7263 as '7,263'
    expect(screen.getByText('7,263')).toBeInTheDocument()
  })

  it('renders wickets stat', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    expect(screen.getByText('Wickets')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('applies blue role badge classes for Batsman', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    const badge = screen.getByText('Batsman')
    expect(badge.className).toContain('bg-blue-900')
    expect(badge.className).toContain('text-blue-300')
  })

  it('applies red role badge classes for Bowler', () => {
    const bowler: Cricketer = { ...mockCricketer, id: 'test-bowler', role: 'Bowler' }
    render(<CricketerCard cricketer={bowler} />)
    const badge = screen.getByText('Bowler')
    expect(badge.className).toContain('bg-red-900')
    expect(badge.className).toContain('text-red-300')
  })

  it('applies emerald role badge classes for All-rounder', () => {
    const allrounder: Cricketer = { ...mockCricketer, id: 'test-allrounder', role: 'All-rounder' }
    render(<CricketerCard cricketer={allrounder} />)
    const badge = screen.getByText('All-rounder')
    expect(badge.className).toContain('bg-emerald-900')
    expect(badge.className).toContain('text-emerald-300')
  })

  it('has a link to the cricketer profile page', () => {
    render(<CricketerCard cricketer={mockCricketer} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('virat-kohli-rcb'))
  })
})
