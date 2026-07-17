import { getSession, SessionPayload } from './session';
import { redirect } from 'next/navigation';

export type Role = 'coordinator' | 'curator' | 'promoter' | 'sponsor';

/**
 * Get current session or redirect to login.
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

/**
 * Get current session AND require specific role(s).
 * Throws a forbidden error if role doesn't match.
 */
export async function requireRole(
  allowedRoles: Role | Role[]
): Promise<SessionPayload> {
  const session = await requireAuth();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const hasMatchingRole = session.roles.some((r) => roles.includes(r as Role));
  if (!hasMatchingRole) {
    redirect('/forbidden');
  }
  return session;
}

/**
 * Get current session without redirecting (returns null if not authenticated).
 */
export async function getOptionalSession(): Promise<SessionPayload | null> {
  return getSession();
}

/**
 * Check if a session belongs to a specific role (for conditional rendering).
 */
export function hasRole(session: SessionPayload | null, role: Role | Role[]): boolean {
  if (!session) return false;
  const roles = Array.isArray(role) ? role : [role];
  return session.roles.some((r) => roles.includes(r as Role));
}
