/**
 * AEGIS-X Backend — Counterfactual & Attribution Explainability
 */

import type { EvidenceRecord, EvidenceItem, AgentRole } from '../core/types.js';
import { bayesianFusion } from '../intelligence/fusionMath.js';

export interface CounterfactualResult {
  baselineProbability: number;
  counterfactualProbability: number;
  pivotEvidence: EvidenceItem[];
  explanation: string;
  wouldReverseVerdict: boolean;
}

/**
 * Determine which evidence, if absent, would most change the verdict.
 */
export function computeCounterfactual(
  evidenceRecords: EvidenceRecord[],
  baseProbability: number
): CounterfactualResult {
  if (evidenceRecords.length === 0) {
    return {
      baselineProbability: baseProbability,
      counterfactualProbability: 50,
      pivotEvidence: [],
      explanation: 'No evidence records available for counterfactual analysis.',
      wouldReverseVerdict: false,
    };
  }

  // Find the most impactful agent to remove
  let maxImpact = 0;
  let pivotIdx = 0;

  for (let i = 0; i < evidenceRecords.length; i++) {
    const reduced = evidenceRecords.filter((_, j) => j !== i);
    const reducedInputs = reduced.map((r) => ({
      confidence: r.confidence,
      likelihoodRatio: r.likelihoodRatio,
      reliabilityWeight: r.reliabilityWeight,
      uncertainty: r.uncertainty,
    }));
    const reducedProb = bayesianFusion(reducedInputs);
    const impact = Math.abs(baseProbability - reducedProb);

    if (impact > maxImpact) {
      maxImpact = impact;
      pivotIdx = i;
    }
  }

  const pivotAgent = evidenceRecords[pivotIdx];
  const reducedInputs = evidenceRecords
    .filter((_, i) => i !== pivotIdx)
    .map((r) => ({
      confidence: r.confidence,
      likelihoodRatio: r.likelihoodRatio,
      reliabilityWeight: r.reliabilityWeight,
      uncertainty: r.uncertainty,
    }));

  const counterfactualProbability = bayesianFusion(reducedInputs);
  const wouldReverseVerdict = counterfactualProbability < 50 && baseProbability >= 50;

  return {
    baselineProbability: baseProbability,
    counterfactualProbability,
    pivotEvidence: pivotAgent.evidence,
    explanation: `Without evidence from ${pivotAgent.agentRole}, posterior probability drops from ${baseProbability}% to ${counterfactualProbability}%. ${wouldReverseVerdict ? 'This WOULD reverse the verdict to CLEAN.' : 'This would NOT reverse the verdict.'}`,
    wouldReverseVerdict,
  };
}

export interface AttributionResult {
  agentRole: AgentRole;
  contribution: number;  // 0-100 (percentage of total likelihood)
  confidence: number;
  evidenceCount: number;
}

/**
 * Attribute how much each agent contributed to the final decision.
 */
export function computeAttribution(evidenceRecords: EvidenceRecord[]): AttributionResult[] {
  const totalLR = evidenceRecords.reduce((s, r) => s + Math.log(Math.max(0.01, r.likelihoodRatio)), 0);

  return evidenceRecords.map((r) => ({
    agentRole: r.agentRole,
    contribution: totalLR > 0
      ? Math.round((Math.log(Math.max(0.01, r.likelihoodRatio)) / totalLR) * 100)
      : Math.round(100 / evidenceRecords.length),
    confidence: r.confidence,
    evidenceCount: r.evidence.length,
  })).sort((a, b) => b.contribution - a.contribution);
}
