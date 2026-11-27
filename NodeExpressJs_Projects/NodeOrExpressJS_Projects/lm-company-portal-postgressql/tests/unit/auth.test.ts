// ============================================================
// Unit tests for JWT helper functions
// WHAT: Tests sign/verify/decode functions in isolation.
// WHY:  Unit tests validate a single function with no external deps.
//       Faster than integration tests, easier to debug failures.
// HOW:  Jest mocks are NOT needed here — JWT is pure computation.
// Interview Tip: Unit tests should be deterministic, fast (<10ms each),
//               and test one thing per test (Single Responsibility).
// ============================================================

import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../../src/utils/jwt.helper';
import { UnauthorizedError } from '../../src/exceptions';

// Mock the config to use predictable test values
jest.mock('../../src/config/env.config', () => ({
  config: {
    jwt: {
      secret: 'test_secret_32_chars_long_minimum',
      refreshSecret: 'test_refresh_secret_32_chars_long',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
  },
}));

describe('JWT Helper', () => {
  const payload = {
    userId: 'user123',
    email: 'test@lm.com',
    role: 'Employee' as const,
    permissions: ['read'] as any,
  };

  describe('signAccessToken', () => {
    it('should return a string token', () => {
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts: header.payload.signature
    });
  });

  describe('verifyAccessToken', () => {
    it('should decode valid token and match payload', () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw UnauthorizedError for invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for tampered token', () => {
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow(UnauthorizedError);
    });
  });

  describe('signRefreshToken + verifyRefreshToken', () => {
    it('should sign and verify refresh token correctly', () => {
      const token = signRefreshToken('user123');
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe('user123');
    });
  });
});
