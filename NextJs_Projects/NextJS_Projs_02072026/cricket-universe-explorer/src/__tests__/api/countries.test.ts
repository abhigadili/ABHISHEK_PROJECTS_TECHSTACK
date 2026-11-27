/**
 * @jest-environment node
 */
import { GET } from '@/app/api/countries/route'
import { NextRequest } from 'next/server'

describe('/api/countries', () => {
  it('GET returns all countries', async () => {
    const request = new NextRequest('http://localhost:3000/api/countries')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
    expect(typeof data.total).toBe('number')
    expect(data.total).toBeGreaterThan(0)
  })

  it('GET returns all countries with correct shape', async () => {
    const request = new NextRequest('http://localhost:3000/api/countries')
    const response = await GET(request)
    const data = await response.json()

    const country = data.data[0]
    expect(country).toHaveProperty('id')
    expect(country).toHaveProperty('name')
    expect(country).toHaveProperty('shortName')
    expect(country).toHaveProperty('board')
    expect(country).toHaveProperty('captain')
  })

  it('GET filters by search param', async () => {
    const request = new NextRequest('http://localhost:3000/api/countries?search=India')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
    expect(data.data[0].name).toContain('India')
    expect(data.filtered).toBe(true)
  })

  it('GET search is case-insensitive', async () => {
    const request = new NextRequest('http://localhost:3000/api/countries?search=india')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.length).toBeGreaterThan(0)
    expect(data.data[0].name).toBe('India')
  })

  it('GET returns empty array for non-matching search', async () => {
    const request = new NextRequest('http://localhost:3000/api/countries?search=NonExistentCountry99')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toEqual([])
    expect(data.total).toBe(0)
  })

  it('GET sets filtered=false when no search param is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/countries')
    const response = await GET(request)
    const data = await response.json()

    expect(data.filtered).toBe(false)
  })
})
