import { describe, it, expect } from 'vitest';
import { verifySession } from '@/lib/auth/session';
import { SignJWT } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'pia-curation-secret-change-in-production-32ch'
);

describe('Session Authentication', () => {
  it('should invalidate old tokens without roles array and return null', async () => {
    // Simulate an old token from before the migration (with 'role' instead of 'roles')
    const oldPayload = {
      userId: 1,
      name: 'Old User',
      email: 'old@pia.id',
      role: 'coordinator', // Old schema
    };

    const oldToken = await new SignJWT(oldPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET);

    const session = await verifySession(oldToken);

    // Should return null and force redirect to login
    expect(session).toBeNull();
  });

  it('should return valid session for new tokens with roles array', async () => {
    const newPayload = {
      userId: 1,
      name: 'New User',
      email: 'new@pia.id',
      roles: ['coordinator', 'curator'], // New schema
    };

    const newToken = await new SignJWT(newPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(SECRET);

    const session = await verifySession(newToken);

    expect(session).not.toBeNull();
    expect(session?.roles).toEqual(['coordinator', 'curator']);
  });
});
