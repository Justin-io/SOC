/**
 * AEGIS-X Backend — Fusion Engine Agent
 * Weighted Bayesian log-odds fusion of all agent EvidenceRecords.
 * Computes final posterior probability, confidence interval, dissent, expected utility.
 * Fully deterministic — no LLM.
 */

import type {
  EvidenceRecord, DecisionIntelligence, AlertRecord, AgentRole
} from '../core/types.js';
import {
  fuseEvidence, dissentLevel, expectedUtility,
} from '../intelligence/fusionMath.js';
import { agentRegistry } from './registry.js';
import { playbookMemory } from '../memory/playbookMemory.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('agents:fusion-engine');
const ROLE: AgentRole = 'FUSION_ENGINE';

export async function runFusionEngine(
  alert: AlertRecord,
  evidenceRecords: EvidenceRecord[]
): Promise<DecisionIntelligence> {
  const start = Date.now();
  agentRegistry.updateStatus(ROLE, 'EXECUTING');

  const incident = alert.incident;

  const fusion = fuseEvidence(evidenceRecords);
  const posterior = Math.round(fusion.posterior * 10000) / 100;
  const ciLower = Math.round(fusion.wilsonLowerBound * 100);
  const dissentScore = fusion.dissentScore;
  const level = dissentLevel(dissentScore);

  // Identify dissenting agents (confidence far from mean)
  const avgConf = evidenceRecords.reduce((s, e) => s + e.confidence, 0) / Math.max(1, evidenceRecords.length);
  const dissentingAgents = evidenceRecords
    .filter((r) => Math.abs(r.confidence - avgConf) > 20)
    .map((r) => r.agentRole);

  // Look up playbook for best containment action
  const playbook = playbookMemory.findForMitre(incident.mitreTechnique.id, incident.asset.type);
  const recommendedAction = playbook?.containmentAction ?? incident.recommendedAction;

  // Compute expected utility of containment
  const utility = expectedUtility(posterior, 0.85, 0.15); // 85% risk reduction, 15% disruption

  // Risk score = composite of posterior + likelihood ratios
  const avgLR = evidenceRecords.reduce((s, e) => s + Math.log(Math.max(0.01, e.likelihoodRatio)), 0) / Math.max(1, evidenceRecords.length);
  const riskScore = Math.min(100, Math.round(posterior * 0.6 + Math.exp(avgLR) * 3 + incident.riskScore * 0.2));

  const decision: DecisionIntelligence = {
    incidentId: incident.id,
    finalProbability: posterior,
    dissentLevel: level,
    dissentAgents: dissentingAgents,
    riskScore,
    // Gating confidence is the conservative Wilson lower bound, never an average.
    confidenceScore: ciLower,
    recommendedAction,
    counterfactualExplanation: incident.counterfactualExplanation,
    businessImpact: incident.businessImpact,
    containmentImpact: incident.containmentImpact,
    approvalStatus: 'PENDING',
  };

  const latencyMs = Date.now() - start;
  agentRegistry.updateStatus(ROLE, 'IDLE');
  agentRegistry.recordExecution(ROLE, latencyMs, true, posterior);

  log.info('Fusion completed', {
    meta: {
      incidentId: incident.id,
      posterior,
      riskScore,
      dissentLevel: level,
      dissentingAgents,
      ciLower,
      requiresHumanGate: fusion.requiresHumanGate,
      utility: utility.toFixed(3),
      latencyMs,
    },
  });

  return decision;
}
