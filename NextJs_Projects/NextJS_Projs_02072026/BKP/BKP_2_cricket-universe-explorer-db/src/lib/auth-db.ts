/**
 * src/lib/auth-db.ts — Auth DB operations (Node.js only)
 *
 * Contains all database interactions for the loginusers table plus
 * bcrypt password hashing/verification. Import this ONLY from route
 * handlers — never from middleware (Edge runtime has no Node.js APIs).
 */

import bcrypt from 'bcryptjs'
import pool from './db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginUser {
  id: number
  name: string
  email: string
  password_hash: string
  role: 'user' | 'admin'
  is_active: number
  last_login: Date | null
  refresh_token_hash: string | null
  refresh_token_expires: Date | null
  created_at: Date
  updated_at: Date
}

// ─── User look-ups ────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<LoginUser | null> {
  const [rows] = await pool.query(
    'SELECT * FROM loginusers WHERE email = ? AND is_active = 1 LIMIT 1',
    [email]
  )
  const users = rows as LoginUser[]
  return users[0] ?? null
}

export async function getUserById(id: number): Promise<LoginUser | null> {
  const [rows] = await pool.query(
    'SELECT * FROM loginusers WHERE id = ? AND is_active = 1 LIMIT 1',
    [id]
  )
  const users = rows as LoginUser[]
  return users[0] ?? null
}

// ─── User creation ────────────────────────────────────────────────────────────

export async function emailExists(email: string): Promise<boolean> {
  const [rows] = await pool.query(
    'SELECT id FROM loginusers WHERE email = ? LIMIT 1',
    [email]
  )
  return (rows as unknown[]).length > 0
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: 'user' | 'admin' = 'user'
): Promise<LoginUser> {
  const hash = await bcrypt.hash(password, 12)
  const [result] = await pool.query(
    'INSERT INTO loginusers (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, email, hash, role]
  )
  const { insertId } = result as { insertId: number }
  const user = await getUserById(insertId)
  return user!
}

// ─── Password verification ────────────────────────────────────────────────────

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ─── Session management ───────────────────────────────────────────────────────

export async function updateLastLogin(userId: number): Promise<void> {
  await pool.query('UPDATE loginusers SET last_login = NOW() WHERE id = ?', [userId])
}

export async function saveRefreshTokenHash(
  userId: number,
  jtiHash: string,
  expiresAt: Date
): Promise<void> {
  await pool.query(
    'UPDATE loginusers SET refresh_token_hash = ?, refresh_token_expires = ? WHERE id = ?',
    [jtiHash, expiresAt, userId]
  )
}

export async function getRefreshTokenData(
  userId: number
): Promise<{ hash: string; expires: Date } | null> {
  const [rows] = await pool.query(
    'SELECT refresh_token_hash, refresh_token_expires FROM loginusers WHERE id = ? LIMIT 1',
    [userId]
  )
  const users = rows as LoginUser[]
  const user = users[0]
  if (!user?.refresh_token_hash || !user?.refresh_token_expires) return null
  return { hash: user.refresh_token_hash, expires: user.refresh_token_expires }
}

export async function revokeRefreshToken(userId: number): Promise<void> {
  await pool.query(
    'UPDATE loginusers SET refresh_token_hash = NULL, refresh_token_expires = NULL WHERE id = ?',
    [userId]
  )
}
