/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// ─── Mock next/headers ────────────────────────────────────────────────────────
// The cookies() API from next/headers is async in Next.js 15. We mock it to
// return a controlled cookie store so tests run without a real Next.js server.

const mockCookieStore = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
}

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}))

// Import AFTER mocking next/headers
import { POST as loginPOST } from '@/app/api/auth/login/route'
import { GET as meGET } from '@/app/api/auth/me/route'

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and success=true with valid credentials', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'fan@cricket.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await loginPOST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('fan@cricket.com')
  })

  it('sets the auth cookie on successful login', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'fan@cricket.com', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })

    await loginPOST(request)

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'auth-token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    )
  })

  it('returns 401 for an invalid email (no @ symbol)', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'notanemail', password: 'password123' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await loginPOST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error).toBeDefined()
  })

  it('returns 401 for a password that is too short', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'fan@cricket.com', password: 'abc' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await loginPOST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('returns 400 when email or password is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'fan@cricket.com' }), // no password
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await loginPOST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  it('returns 500 for malformed JSON body', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: 'not-valid-json',
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await loginPOST(request)

    expect(response.status).toBe(500)
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when no auth cookie is present', async () => {
    // Simulate missing cookie
    mockCookieStore.get.mockReturnValue(undefined)

    const response = await meGET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('returns 401 when auth cookie contains an invalid token', async () => {
    // Simulate a malformed/expired token cookie
    mockCookieStore.get.mockReturnValue({ value: 'invalid-base64-token' })

    const response = await meGET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
  })

  it('returns 200 and user data when a valid auth cookie is present', async () => {
    // Create a valid mock token (same logic as createMockToken in auth.ts)
    const payload = {
      userId: '1',
      email: 'fan@cricket.com',
      exp: Date.now() + 86_400_000, // 24 hours from now
    }
    const validToken = btoa(JSON.stringify(payload))

    mockCookieStore.get.mockReturnValue({ value: validToken })

    const response = await meGET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('fan@cricket.com')
  })
})
