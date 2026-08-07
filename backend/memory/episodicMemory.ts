/**
 * AEGIS-X Backend — Episodic Memory
 * Stores completed investigations for retrieval and learning.
 */

import type { InvestigationState, Severity } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('memory:episodic');

interface EpisodicEntry {
  investigationId: string;
  incidentId: string;
  title: string;
  severity: Severity;
  mitreIds: string[];
  assetType: string;
  outcomeStatus: string;
  finalProbability: number;
  containmentAction: string;
  wasSuccessful: boolean;
  completedAt: string;
  durationMs: number;
  agentCount: number;
}

class EpisodicMemory {
  private store: EpisodicEntry[] = [];
  private maxEntries = 500;

  store_investigation(state: InvestigationState): void {
    if (!state.decision) return;

    const entry: EpisodicEntry = {
      investigationId: state.investigationId,
      incidentId: state.incidentId,
      title: `Investigation ${state.incidentId}`,
      severity: 'HIGH', // default
      mitreIds: [],
      assetType: 'Server',
      outcomeStatus: state.status,
      finalProbability: state.decision.finalProbability,
      containmentAction: state.decision.recommendedAction,
      wasSuccessful: state.decision.approvalStatus === 'APPROVED',
      completedAt: state.completedAt ?? new Date().toISOString(),
      durationMs: state.completedAt
        ? new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()
        : 0,
      agentCount: state.completedAgents.length,
    };

    this.store.unshift(entry);
    if (this.store.length > this.maxEntries) {
      this.store.pop();
    }

    log.info('Investigation stored in episodic memory', {
      meta: { investigationId: state.investigationId, incidentId: state.incidentId },
    });
  }

  findSimilar(mitreIds: string[], assetType: string, severity: Severity, limit = 5): EpisodicEntry[] {
    return this.store
      .map((e) => {
        let score = 0;
        if (e.severity === severity) score += 3;
        if (e.assetType === assetType) score += 2;
        const mitreOverlap = mitreIds.filter((m) => e.mitreIds.includes(m)).length;
        score += mitreOverlap * 2;
        return { entry: e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.entry);
  }

  getAll(): EpisodicEntry[] {
    return [...this.store];
  }

  getStats() {
    return {
      totalInvestigations: this.store.length,
      successfulContainments: this.store.filter((e) => e.wasSuccessful).length,
      avgFinalProbability: this.store.length > 0
        ? Math.round(this.store.reduce((s, e) => s + e.finalProbability, 0) / this.store.length)
        : 0,
      avgDurationMs: this.store.length > 0
        ? Math.round(this.store.reduce((s, e) => s + e.durationMs, 0) / this.store.length)
        : 0,
    };
  }
}

export const episodicMemory = new EpisodicMemory();
