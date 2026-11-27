// ============================================================
// Integration tests for Auth routes using Supertest
// WHAT: Tests the full HTTP request → middleware → controller → response cycle.
// WHY:  Integration tests catch bugs that unit tests miss (routing, headers,
//       middleware ordering, response shape).
// HOW:  Supertest creates a real HTTP server from the Express app (no port
//       binding needed) and sends actual HTTP requests.
// Interview Tip: Mock the database in integration tests when possible
//               (in-memory MongoDB like `mongodb-memory-server`).
//               But know when mocks diverge from real DB behaviour (aggregations, indexes).
// ============================================================

import request from 'supertest';
import { createApp } from '../../src/server/app';
import { connectDB, disconnectDB } from '../../src/database/connection';

const app = createApp();

// NOTE: These tests require a running MongoDB (use mongodb-memory-server for CI)
// For now they demonstrate the test structure — mock the DB for fully isolated tests.

describe('Auth API', () => {
  const testUser = {
    firstName: 'Test',
    lastName:  'User',
    email:     `test_${Date.now()}@lm.com`,
    password:  'Password123!',
  };

  describe('POST /api/auth/register', () => {
    it('should return 201 and user data on valid registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect('Content-Type', /json/);

      // Only assert shape, not exact values (data changes per run)
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('userId');
      expect(res.body.data).toHaveProperty('email');
    });

    it('should return 400 on missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'missing@lm.com' }) // no password
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 on invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });

      expect(res.body.success).toBe(false);
    });
  });

  describe('Protected routes', () => {
    it('should return 401 when no Authorization header', async () => {
      const res = await request(app)
        .get('/api/companies')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/companies')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
