/**
 * AEGIS-X Backend — Playbook Memory
 * Stores successful containment strategies.
 * Agents query this to bias recommendations toward proven tactics.
 */

import type { AgentRole } from '../core/types.js';

interface Playbook {
  id: string;
  mitreId: string;
  assetType: string;
  containmentAction: string;
  successRate: number;
  usageCount: number;
  avgTimeToContainMs: number;
  contributors: AgentRole[];
  lastUsedAt: string;
}

const SEED_PLAYBOOKS: Playbook[] = [
  {
    id: 'PB-001',
    mitreId: 'T1003.001',
    assetType: 'Domain Controller',
    containmentAction: 'Isolate DC, purge KRBTGT tickets, force krbtgt double-reset, enable LAPS on affected OU.',
    successRate: 96,
    usageCount: 23,
    avgTimeToContainMs: 204_000,
    contributors: ['INCIDENT_RESPONSE', 'CLOUD', 'COORDINATOR'],
    lastUsedAt: '2026-08-05T14:30:00Z',
  },
  {
    id: 'PB-002',
    mitreId: 'T1530',
    assetType: 'AWS S3 Bucket',
    containmentAction: 'Attach explicit IAM Deny inline policy, revoke STS session tokens, enable S3 Block Public Access, enable Macie PII scan.',
    successRate: 98,
    usageCount: 11,
    avgTimeToContainMs: 89_000,
    contributors: ['CLOUD', 'COMPLIANCE', 'COORDINATOR'],
    lastUsedAt: '2026-08-06T09:15:00Z',
  },
  {
    id: 'PB-003',
    mitreId: 'T1611',
    assetType: 'Kubernetes Worker Node',
    containmentAction: 'Cordon & drain pod, revoke cluster-admin ServiceAccount, apply NetworkPolicy egress block.',
    successRate: 91,
    usageCount: 8,
    avgTimeToContainMs: 156_000,
    contributors: ['CLOUD', 'INCIDENT_RESPONSE'],
    lastUsedAt: '2026-08-04T22:00:00Z',
  },
  {
    id: 'PB-004',
    mitreId: 'T1059.001',
    assetType: 'Workstation',
    containmentAction: 'Isolate endpoint via EDR, run memory forensics, reset user credentials, disable PowerShell unrestricted mode via GPO.',
    successRate: 89,
    usageCount: 34,
    avgTimeToContainMs: 320_000,
    contributors: ['INCIDENT_RESPONSE', 'MALWARE'],
    lastUsedAt: '2026-08-07T01:00:00Z',
  },
];

class PlaybookMemory {
  private playbooks: Playbook[] = [...SEED_PLAYBOOKS];

  findForMitre(mitreId: string, assetType?: string): Playbook | null {
    // Exact match first, then partial
    const exact = this.playbooks.find(
      (p) => p.mitreId === mitreId && (!assetType || p.assetType === assetType)
    );
    if (exact) return exact;
    return this.playbooks.find((p) => mitreId.startsWith(p.mitreId.split('.')[0])) ?? null;
  }

  recordSuccess(playbookId: string, timeToContainMs: number): void {
    const pb = this.playbooks.find((p) => p.id === playbookId);
    if (!pb) return;
    pb.usageCount++;
    pb.lastUsedAt = new Date().toISOString();
    pb.avgTimeToContainMs = Math.round(
      (pb.avgTimeToContainMs * (pb.usageCount - 1) + timeToContainMs) / pb.usageCount
    );
  }

  getAll(): Playbook[] {
    return [...this.playbooks];
  }
}

export const playbookMemory = new PlaybookMemory();
