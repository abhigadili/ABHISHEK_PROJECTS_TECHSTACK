'use client'

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '@/components/ui/SearchBar'

describe('SearchBar', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders the search input', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('renders with default placeholder text', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('renders with custom placeholder text', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} placeholder="Search countries…" />)
    expect(screen.getByPlaceholderText('Search countries…')).toBeInTheDocument()
  })

  it('calls onSearch with the typed value after debounce delay', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'India' } })

    // onSearch should not have been called immediately (debounced)
    expect(onSearch).not.toHaveBeenCalledWith('India')

    // Advance past the 300ms debounce window
    jest.runAllTimers()

    expect(onSearch).toHaveBeenCalledWith('India')
  })

  it('does not call onSearch multiple times for rapid keystrokes', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')

    // Simulate rapid typing
    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.change(input, { target: { value: 'Au' } })
    fireEvent.change(input, { target: { value: 'Aus' } })

    jest.runAllTimers()

    // Should only be called once with the final value
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('Aus')
  })

  it('does not show clear button when input is empty', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
  })

  it('shows clear button when input has a value', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'India' } })

    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument()
  })

  it('clears input and calls onSearch with empty string when clear button is clicked', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'India' } })

    const clearButton = screen.getByRole('button', { name: /clear search/i })
    fireEvent.click(clearButton)

    // Input should be cleared
    expect(input).toHaveValue('')

    // onSearch should be called immediately with '' (no debounce on clear)
    expect(onSearch).toHaveBeenCalledWith('')

    // Clear button should disappear
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
  })

  it('trims whitespace before calling onSearch', () => {
    const onSearch = jest.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: '  India  ' } })
    jest.runAllTimers()

    expect(onSearch).toHaveBeenCalledWith('India')
  })
})
