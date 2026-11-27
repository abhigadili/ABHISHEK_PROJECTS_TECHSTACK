/**
 * POST /api/auth/register
 *
 * Creates a new user account, then issues both tokens so the user is immediately
 * logged in after registration — no separate login step required.
 *
 * Validation rules:
 *   name     — required, 2–100 chars
 *   email    — required, valid email, must not already exist
 *   password — required, min 8 chars, at least one uppercase + one digit
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash, randomUUID } from 'crypto'
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_MS,
} from '@/lib/auth'
import { emailExists, createUser, saveRefreshTokenHash } from '@/lib/auth-db'

// Minimal email regex — full RFC 5322 validation is overkill for a form
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { name, email, password, confirmPassword } = body as {
      name?: string
      email?: string
      password?: string
      confirmPassword?: string
    }

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name?.trim() || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Name must be at least 2 characters.' },
        { status: 400 }
      )
    }
    if (name.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: 'Name must be under 100 characters.' },
        { status: 400 }
      )
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required.' },
        { status: 400 }
      )
    }
    const pwError = validatePassword(password)
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Passwords do not match.' },
        { status: 400 }
      )
    }

    // ── Uniqueness check ──────────────────────────────────────────────────────
    const normalizedEmail = email.toLowerCase().trim()
    if (await emailExists(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    // ── Create user ───────────────────────────────────────────────────────────
    const dbUser = await createUser(name.trim(), normalizedEmail, password)

    const user = {
      id: String(dbUser.id),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    }

    // ── Issue tokens ──────────────────────────────────────────────────────────
    const jti = randomUUID()
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user),
      signRefreshToken(user.id, jti),
    ])

    const jtiHash = createHash('sha256').update(jti).digest('hex')
    const rtExpires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
    await saveRefreshTokenHash(dbUser.id, jtiHash, rtExpires)

    // ── Set httpOnly cookies ──────────────────────────────────────────────────
    const secure = process.env.NODE_ENV === 'production'
    const cookieStore = await cookies()

    cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    })

    cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth',
    })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
