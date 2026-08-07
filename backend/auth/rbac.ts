/**
 * AEGIS-X Backend — Basic RBAC
 * Role definitions, permission maps, JWT validation stub.
 */

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
  READ_ONLY: {
    canApproveContainment: false,
    canModifySettings: false,
    canGenerateReports: false,
    canViewAudit: true,
    canManageAgents: false,
    canEscalate: false,
  },
  SOC_ANALYST: {
    canApproveContainment: false,
    canModifySettings: false,
    canGenerateReports: true,
    canViewAudit: true,
    canManageAgents: false,
    canEscalate: true,
  },
  SOC_LEAD: {
    canApproveContainment: true,
    canModifySettings: false,
    canGenerateReports: true,
    canViewAudit: true,
    canManageAgents: true,
    canEscalate: true,
  },
  INCIDENT_COMMANDER: {
    canApproveContainment: true,
    canModifySettings: true,
    canGenerateReports: true,
    canViewAudit: true,
    canManageAgents: true,
    canEscalate: true,
  },
  ADMIN: {
    canApproveContainment: true,
    canModifySettings: true,
    canGenerateReports: true,
    canViewAudit: true,
    canManageAgents: true,
    canEscalate: true,
  },
};

export function hasPermission(role: UserRole, permission: keyof Permission): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}
