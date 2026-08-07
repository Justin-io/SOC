/**
 * AEGIS-X Backend — Audit Memory
 * Queryable audit event store indexed by incident, actor, and action type.
 * Wraps the immutable AuditChain with search and filtering.
 */

import type { AuditBlock } from '../core/types.js';
import { auditChain } from '../audit/auditChain.js';

export class AuditMemory {
  /**
   * Query audit blocks with filters.
   */
  query(params: {
    incidentId?: string;
    actor?: string;
    actorType?: AuditBlock['actorType'];
    actionContains?: string;
    limit?: number;
    offset?: number;
  }): { blocks: AuditBlock[]; total: number } {
    let blocks = auditChain.getChain(10_000, 0);

    if (params.incidentId) {
      blocks = blocks.filter((b) => b.incidentId === params.incidentId);
    }
    if (params.actor) {
      blocks = blocks.filter((b) => b.actor.toLowerCase().includes(params.actor!.toLowerCase()));
    }
    if (params.actorType) {
      blocks = blocks.filter((b) => b.actorType === params.actorType);
    }
    if (params.actionContains) {
      blocks = blocks.filter((b) =>
        b.action.toLowerCase().includes(params.actionContains!.toLowerCase())
      );
    }

    const total = blocks.length;
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    return { blocks: blocks.slice(offset, offset + limit), total };
  }

  getIncidentHistory(incidentId: string): AuditBlock[] {
    return auditChain.getByIncident(incidentId);
  }

  verify() {
    return auditChain.verify();
  }
}

export const auditMemory = new AuditMemory();
