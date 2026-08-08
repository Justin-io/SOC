/**
 * AEGIS-X Backend — Fusion Mathematics
 * Pure, deterministic, side-effect-free mathematical reasoning engine.
 */

import type { EvidenceRecord } from '../core/types.js';

const PROBABILITY_EPSILON = 1e-6;

function clampProbability(value: number): number {
  return Math.max(PROBABILITY_EPSILON, Math.min(1 - PROBABILITY_EPSILON, value));
}

/** Convert a probability in [0, 1] to log-odds. */
export function probToLogOdds(p: number): number {
  const clamped = clampProbability(p);
  return Math.log(clamped / (1 - clamped));
}

/** Convert log-odds back to a probability in [0, 1]. */
export function logOddsToProb(logOdds: number): number {
  if (logOdds >= 0) {
    const expNeg = Math.exp(-logOdds);
    return 1 / (1 + expNeg);
  }
  const expPos = Math.exp(logOdds);
  return expPos / (1 + expPos);
}

export interface AgentEvidence {
  confidence: number;          // 0-100
  likelihoodRatio: number;     // retained for legacy callers; fusion derives LR from confidence
  reliabilityWeight: number;   // 0-1
  uncertainty: number;         // 0-1
}

export interface FusionResult {
  posterior: number;
  wilsonLowerBound: number;
  dissentScore: number;
  requiresHumanGate: boolean;
}

/**
 * Fuse evidence with the documented base-rate-normalised log-odds equation.
 *
 * p_i is each agent's reported confidence as a probability, and the effective
 * weight is reliabilityWeight × (1 - uncertainty). The returned posterior and
 * Wilson lower bound are probabilities in [0, 1].
 */
export function fuseEvidence(
  evidences: EvidenceRecord[],
  prior = 0.04,
): FusionResult {
  const normalizedPrior = clampProbability(prior);
  let logitPosterior = probToLogOdds(normalizedPrior);

  for (const evidence of evidences) {
    const p = clampProbability(evidence.confidence / 100);
    const likelihoodRatio = (p / (1 - p)) / (normalizedPrior / (1 - normalizedPrior));
    const weight = Math.max(0, Math.min(1, evidence.reliabilityWeight))
      * (1 - Math.max(0, Math.min(1, evidence.uncertainty)));
    logitPosterior += weight * Math.log(likelihoodRatio);
  }

  const posterior = logOddsToProb(logitPosterior);
  const [wilsonLowerBound] = wilsonInterval(posterior, evidences.length);
  const dissentScore = computeDissentScore(evidences);

  return {
    posterior,
    wilsonLowerBound,
    dissentScore,
    requiresHumanGate: dissentScore > 1.5,
  };
}

/**
 * Legacy percentage API. New callers should use fuseEvidence.
 * It applies the same 4% base-rate prior rather than an uninformative prior.
 */
export function bayesianFusion(evidenceList: AgentEvidence[]): number {
  const records = evidenceList.map((evidence, index) => ({
    ...evidence,
    agentRole: 'COORDINATOR' as const,
    evidence: [],
    toolsUsed: [],
    executionTimeMs: 0,
    timestamp: String(index),
  }));
  return Math.round(fuseEvidence(records).posterior * 100);
}

/** Wilson 95% interval for a probability. */
export function wilsonInterval(posterior: number, sampleSize: number): [number, number] {
  const p = clampProbability(posterior);
  const n = Math.max(1, sampleSize);
  const z = 1.96;
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const spread = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
}

/** Legacy percentage Wilson interval API. */
export function confidenceInterval(posterior: number, sampleSize: number): [number, number] {
  const [lower, upper] = wilsonInterval(posterior / 100, sampleSize);
  return [Math.round(lower * 100), Math.round(upper * 100)];
}

/** Population standard deviation of agent-confidence logits. */
export function computeDissentScore(evidenceList: Array<Pick<AgentEvidence, 'confidence'>>): number {
  if (evidenceList.length < 2) return 0;
  const logits = evidenceList.map((evidence) => probToLogOdds(evidence.confidence / 100));
  const mean = logits.reduce((sum, logit) => sum + logit, 0) / logits.length;
  const variance = logits.reduce((sum, logit) => sum + (logit - mean) ** 2, 0) / logits.length;
  return Math.sqrt(variance);
}

export type DissentLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

/** Display-only categorisation for the logit-scale dissent score. */
export function dissentLevel(score: number): DissentLevel {
  if (score === 0) return 'NONE';
  if (score < 0.5) return 'LOW';
  if (score <= 1.5) return 'MODERATE';
  return 'HIGH';
}

/** Expected containment utility; all values are probabilities in [0, 1] except posterior percent. */
export function expectedUtility(
  posterior: number,
  riskReduction: number,
  businessDisruption: number,
): number {
  const p = posterior / 100;
  return Math.max(0, Math.min(1, riskReduction * p - businessDisruption * (1 - p)));
}

export function poissonAnomalyScore(observed: number, expectedRate: number): number {
  if (expectedRate <= 0) return observed > 0 ? 10 : 0;
  const lambda = Math.max(0.001, expectedRate);
  if (observed === 0) return 0;
  return Math.max(0, observed * Math.log(observed / lambda) - (observed - lambda));
}

export function markovSurprise(transitionProbability: number): number {
  return -Math.log2(Math.max(0.001, transitionProbability));
}

export function isConformalAnomaly(score: number, calibratedQuantile: number): boolean {
  return score > calibratedQuantile;
}

export function movingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

export function ewma(values: number[], alpha = 0.3): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = alpha * values[i] + (1 - alpha) * result;
  return result;
}
