/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server'

// ─── Import middleware directly ───────────────────────────────────────────────
// We import from src/middleware.ts (the canonical location in a src/ layout).
import { middleware } from '@/middleware'

// Helper to create a NextRequest with optional cookie
function createRequest(
  pathname: string,
  options: { authToken?: string } = {}
): NextRequest {
  const url = `http://localhost:3000${pathname}`
  const request = new NextRequest(url)
  if (options.authToken) {
    // Directly set the cookie on the request headers
    request.cookies.set('auth-token', options.authToken)
  }
  return request
}

describe('middleware', () => {
  describe('auth guard — protected routes', () => {
    it('redirects unauthenticated requests to /dashboard to /login', () => {
      const request = createRequest('/dashboard')
      const response = middleware(request)

      expect(response.status).toBe(307)
      const location = response.headers.get('location')
      expect(location).toContain('/login')
    })

    it('includes callbackUrl in the redirect for /dashboard', () => {
      const request = createRequest('/dashboard')
      const response = middleware(request)

      const location = response.headers.get('location') ?? ''
      expect(location).toContain('callbackUrl=%2Fdashboard')
    })

    it('redirects unauthenticated requests to /profile to /login', () => {
      const request = createRequest('/profile')
      const response = middleware(request)

      expect(response.status).toBe(307)
      const location = response.headers.get('location') ?? ''
      expect(location).toContain('/login')
    })

    it('redirects unauthenticated requests to nested /dashboard/settings to /login', () => {
      const request = createRequest('/dashboard/settings')
      const response = middleware(request)

      expect(response.status).toBe(307)
    })
  })

  describe('auth guard — authenticated requests pass through', () => {
    it('allows authenticated requests to /dashboard', () => {
      // Create a valid-looking token (non-expired base64 payload)
      const payload = {
        userId: '1',
        email: 'fan@cricket.com',
        exp: Date.now() + 86_400_000,
      }
      const validToken = btoa(JSON.stringify(payload))

      const request = createRequest('/dashboard', { authToken: validToken })
      const response = middleware(request)

      // Should NOT redirect — status will be undefined (NextResponse.next()) or 200
      expect(response.status).not.toBe(307)
      expect(response.status).not.toBe(308)
    })

    it('allows authenticated requests to /profile', () => {
      const payload = {
        userId: '1',
        email: 'fan@cricket.com',
        exp: Date.now() + 86_400_000,
      }
      const validToken = btoa(JSON.stringify(payload))

      const request = createRequest('/profile', { authToken: validToken })
      const response = middleware(request)

      expect(response.status).not.toBe(307)
    })
  })

  describe('X-Request-Id header', () => {
    it('adds x-request-id header to the response for public routes', () => {
      const request = createRequest('/api/countries')
      const response = middleware(request)

      expect(response.headers.get('x-request-id')).toBeTruthy()
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(response.headers.get('x-request-id')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('adds x-request-id header to authenticated protected routes', () => {
      const payload = {
        userId: '1',
        email: 'fan@cricket.com',
        exp: Date.now() + 86_400_000,
      }
      const validToken = btoa(JSON.stringify(payload))
      const request = createRequest('/dashboard', { authToken: validToken })
      const response = middleware(request)

      expect(response.headers.get('x-request-id')).toBeTruthy()
    })

    it('generates a unique x-request-id for each request', () => {
      const r1 = middleware(createRequest('/api/countries'))
      const r2 = middleware(createRequest('/api/countries'))

      expect(r1.headers.get('x-request-id')).not.toBe(r2.headers.get('x-request-id'))
    })
  })

  describe('custom app headers', () => {
    it('adds x-app-name header to the response', () => {
      const request = createRequest('/api/countries')
      const response = middleware(request)

      expect(response.headers.get('x-app-name')).toBeTruthy()
    })

    it('adds x-app-version header to the response', () => {
      const request = createRequest('/api/countries')
      const response = middleware(request)

      expect(response.headers.get('x-app-version')).toBeTruthy()
    })
  })
})
