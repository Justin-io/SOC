/** JWT (HS256 only) RBAC middleware. */

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type UserRole = 'SOC_ANALYST' | 'SOC_LEAD' | 'INCIDENT_COMMANDER' | 'ADMIN' | 'READ_ONLY';

export interface Permission {
  canApproveContainment: boolean;
  canModifySettings: boolean;
  canGenerateReports: boolean;
  canViewAudit: boolean;
  canManageAgents: boolean;
  canEscalate: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  READ_ONLY: { canApproveContainment: false, canModifySettings: false, canGenerateReports: false, canViewAudit: true, canManageAgents: false, canEscalate: false },
  SOC_ANALYST: { canApproveContainment: false, canModifySettings: false, canGenerateReports: true, canViewAudit: true, canManageAgents: false, canEscalate: true },
  SOC_LEAD: { canApproveContainment: true, canModifySettings: false, canGenerateReports: true, canViewAudit: true, canManageAgents: true, canEscalate: true },
  INCIDENT_COMMANDER: { canApproveContainment: true, canModifySettings: true, canGenerateReports: true, canViewAudit: true, canManageAgents: true, canEscalate: true },
  ADMIN: { canApproveContainment: true, canModifySettings: true, canGenerateReports: true, canViewAudit: true, canManageAgents: true, canEscalate: true },
};

export function hasPermission(role: UserRole, permission: keyof Permission): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64');
}

function parseRole(value: unknown): UserRole | null {
  return typeof value === 'string' && value in ROLE_PERMISSIONS ? value as UserRole : null;
}

function verifyHs256Jwt(token: string, secret: string): UserRole | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8')) as { alg?: unknown };
    // Explicit algorithm allow-list: reject `none` and every non-HS256 algorithm.
    if (header.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const supplied = base64UrlDecode(parts[2]);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8')) as { role?: unknown; exp?: unknown };
    if (typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return parseRole(payload.role);
  } catch {
    return null;
  }
}

/**
 * Require a permission for a state-changing route.
 * Prototype only: outside production, x-dev-role may supply a known role so the
 * demo works without a token. Production ignores that header and requires HS256.
 */
export function requirePermission(permission: keyof Permission): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const devRole = process.env.NODE_ENV !== 'production' ? parseRole(req.header('x-dev-role')) : null;
    const authorization = req.header('authorization');
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const jwtSecret = process.env.JWT_SECRET;
    const role = devRole ?? (token && jwtSecret ? verifyHs256Jwt(token, jwtSecret) : null);
    if (!role) {
      res.status(401).json({ success: false, error: 'Authentication required', timestamp: new Date().toISOString() });
      return;
    }
    if (!hasPermission(role, permission)) {
      res.status(403).json({ success: false, error: 'Permission denied', timestamp: new Date().toISOString() });
      return;
    }
    (req as Request & { authRole?: UserRole }).authRole = role;
    next();
  };
}
