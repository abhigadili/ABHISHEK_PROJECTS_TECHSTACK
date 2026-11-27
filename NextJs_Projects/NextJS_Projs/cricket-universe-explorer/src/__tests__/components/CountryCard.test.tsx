import { render, screen } from '@testing-library/react'
import CountryCard from '@/components/ui/CountryCard'
import type { Country } from '@/types'

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>
  }
})

const mockCountry: Country = {
  id: 'ind',
  name: 'India',
  shortName: 'IND',
  flag: '🇮🇳',
  description: 'India is the birthplace of cricket legends.',
  background: 'Rich cricket history spanning over 100 years.',
  established: 1928,
  worldCupsWon: 2,
  board: 'BCCI',
  coach: 'Gautam Gambhir',
  captain: 'Rohit Sharma',
  famousPlayers: ['Sachin Tendulkar', 'Virat Kohli'],
}

describe('CountryCard', () => {
  it('renders country name', () => {
    render(<CountryCard country={mockCountry} />)
    expect(screen.getByText('India')).toBeInTheDocument()
  })

  it('renders country flag', () => {
    render(<CountryCard country={mockCountry} />)
    expect(screen.getByText('🇮🇳')).toBeInTheDocument()
  })

  it('renders captain name', () => {
    render(<CountryCard country={mockCountry} />)
    expect(screen.getByText(/Rohit Sharma/i)).toBeInTheDocument()
  })

  it('renders board name', () => {
    render(<CountryCard country={mockCountry} />)
    expect(screen.getByText(/BCCI/i)).toBeInTheDocument()
  })

  it('has a link to the country page', () => {
    render(<CountryCard country={mockCountry} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('ind'))
  })
})
