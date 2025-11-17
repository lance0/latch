/**
 * Tests for DX improvement helpers (v0.4.3)
 * - isLatchSession() - Type guard (pure function, easy to test)
 * - checkLatchHealth() - Config validation (pure function, easy to test)
 * 
 * Note: requireServerSession() is tested indirectly via integration tests
 * since it depends on Next.js cookies() which requires complex mocking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isLatchSession, checkLatchHealth } from '../src/helpers';
import { LatchSession } from '../src/types';

describe('isLatchSession', () => {
  it('should return true for authenticated session with user', () => {
    const session: LatchSession = {
      isAuthenticated: true,
      user: {
        sub: 'user-123',
        oid: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      },
    };

    expect(isLatchSession(session)).toBe(true);
  });

  it('should return false for null session', () => {
    expect(isLatchSession(null)).toBe(false);
  });

  it('should return false when not authenticated', () => {
    const session: LatchSession = {
      isAuthenticated: false,
      user: null,
    };

    expect(isLatchSession(session)).toBe(false);
  });

  it('should return false when user is null despite isAuthenticated being true', () => {
    const session: LatchSession = {
      isAuthenticated: true,
      user: null, // Edge case - should not happen but type guard handles it
    };

    expect(isLatchSession(session)).toBe(false);
  });

  it('should return false when isAuthenticated is false despite user existing', () => {
    const session: LatchSession = {
      isAuthenticated: false,
      user: {
        sub: 'user-123',
        oid: 'user-123',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      },
    };

    expect(isLatchSession(session)).toBe(false);
  });

  it('should narrow TypeScript type correctly', () => {
    const session: LatchSession = {
      isAuthenticated: true,
      user: {
        sub: 'user-123',
        oid: 'user-123',
        email: 'test@example.com',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      },
    };

    if (isLatchSession(session)) {
      // TypeScript should know user is not null
      expect(session.user.sub).toBe('user-123');
      expect(session.user.email).toBe('test@example.com');
    }
  });
});

describe('checkLatchHealth', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should return configured=true when all required vars are set', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32); // 32+ characters
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing LATCH_CLIENT_ID', () => {
    delete process.env.LATCH_CLIENT_ID;
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_CLIENT_ID missing');
  });

  it('should detect missing LATCH_TENANT_ID', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    delete process.env.LATCH_TENANT_ID;
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_TENANT_ID missing');
  });

  it('should detect missing LATCH_COOKIE_SECRET', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    delete process.env.LATCH_COOKIE_SECRET;
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_COOKIE_SECRET missing');
  });

  it('should detect missing LATCH_CLOUD', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    delete process.env.LATCH_CLOUD;
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_CLOUD missing');
  });

  it('should detect missing LATCH_SCOPES', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.LATCH_CLOUD = 'commercial';
    delete process.env.LATCH_SCOPES;
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_SCOPES missing');
  });

  it('should detect missing LATCH_REDIRECT_URI', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    delete process.env.LATCH_REDIRECT_URI;

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_REDIRECT_URI missing');
  });

  it('should warn if LATCH_COOKIE_SECRET is too short', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'short'; // Less than 32 characters
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';

    const result = checkLatchHealth();

    expect(result.configured).toBe(true); // Still configured, but with warning
    expect(result.warnings).toContain('LATCH_COOKIE_SECRET should be at least 32 characters');
  });

  it('should warn if LATCH_CLIENT_SECRET is not set', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';
    delete process.env.LATCH_CLIENT_SECRET;

    const result = checkLatchHealth();

    expect(result.configured).toBe(true); // Still configured, just a warning
    expect(result.warnings).toContain('LATCH_CLIENT_SECRET not set (using public client mode)');
  });

  it('should detect multiple missing variables', () => {
    delete process.env.LATCH_CLIENT_ID;
    delete process.env.LATCH_TENANT_ID;
    delete process.env.LATCH_COOKIE_SECRET;

    const result = checkLatchHealth();

    expect(result.configured).toBe(false);
    expect(result.errors).toContain('LATCH_CLIENT_ID missing');
    expect(result.errors).toContain('LATCH_TENANT_ID missing');
    expect(result.errors).toContain('LATCH_COOKIE_SECRET missing');
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should return no warnings when CLIENT_SECRET is set', () => {
    process.env.LATCH_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
    process.env.LATCH_TENANT_ID = '11111111-1111-1111-1111-111111111111';
    process.env.LATCH_COOKIE_SECRET = 'a'.repeat(32);
    process.env.LATCH_CLOUD = 'commercial';
    process.env.LATCH_SCOPES = 'openid profile email';
    process.env.LATCH_REDIRECT_URI = 'http://localhost:3000/api/latch/callback';
    process.env.LATCH_CLIENT_SECRET = 'my-secret';

    const result = checkLatchHealth();

    expect(result.configured).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
