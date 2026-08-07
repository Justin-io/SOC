/**
 * AEGIS-X Backend — Fusion Mathematics
 * Pure, deterministic, side-effect-free mathematical reasoning engine.
 * All functions are pure. No I/O, no state, no logging.
 */

// ─── Bayesian Log-Odds Fusion ──────────────────────────────────────────────

/**
 * Convert probability (0-1) to log-odds.
 */
export function probToLogOdds(p: number): number {
  const clamped = Math.max(0.001, Math.min(0.999, p));
  return Math.log(clamped / (1 - clamped));
}

/**
 * Convert log-odds back to probability (0-1).
 */
export function logOddsToProb(logOdds: number): number {
  return 1 / (1 + Math.exp(-logOdds));
}

export interface AgentEvidence {
  confidence: number;          // 0-100
  likelihoodRatio: number;     // > 0
  reliabilityWeight: number;   // 0-1
  uncertainty: number;         // 0-1
}

/**
 * Combine evidence from multiple agents using weighted Bayesian log-odds.
 * Prior is 50% (uninformative). Each agent shifts the posterior.
 * Returns posterior probability 0-100.
 */
export function bayesianFusion(evidenceList: AgentEvidence[]): number {
  if (evidenceList.length === 0) return 50;

  // Uninformative prior: 50%
  let logOdds = probToLogOdds(0.5);

  for (const e of evidenceList) {
    const confidence = Math.max(0.01, Math.min(0.99, e.confidence / 100));
    const likelihoodContrib = Math.log(Math.max(0.01, e.likelihoodRatio));
    const reliability = Math.max(0.1, Math.min(1.0, e.reliabilityWeight));
    const uncertaintyPenalty = 1 - e.uncertainty;

    logOdds += likelihoodContrib * reliability * uncertaintyPenalty;
  }

  return Math.round(logOddsToProb(logOdds) * 100);
}

/**
 * Compute 95% confidence interval around posterior probability.
 * Uses simplified Wilson interval approximation.
 * Returns [lower, upper] as 0-100.
 */
export function confidenceInterval(posterior: number, sampleSize: number): [number, number] {
  const p = posterior / 100;
  const n = Math.max(1, sampleSize);
  const z = 1.96; // 95% confidence

  const center = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const spread = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / (1 + (z * z) / n);

  const lower = Math.round(Math.max(0, (center - spread) * 100));
  const upper = Math.round(Math.min(100, (center + spread) * 100));

  return [lower, upper];
}

/**
 * Compute dissent score across agents.
 * High dissent = agents disagree significantly.
 * Returns 0-100.
 */
export function computeDissentScore(evidenceList: AgentEvidence[]): number {
  if (evidenceList.length < 2) return 0;

  const confidences = evidenceList.map((e) => e.confidence);
  const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
  const stdDev = Math.sqrt(variance);

  // Normalise: stddev of 25 = 50% dissent (arbitrary but reasonable)
  return Math.min(100, Math.round((stdDev / 25) * 50));
}

export type DissentLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';

export function dissentLevel(score: number): DissentLevel {
  if (score < 10) return 'NONE';
  if (score < 30) return 'LOW';
  if (score < 60) return 'MODERATE';
  return 'HIGH';
}

/**
 * Compute expected utility of containment action.
 * EU = (riskReduction * posterior) - (businessDisruption * (1 - posterior))
 * All values 0-1. Returns 0-1.
 */
export function expectedUtility(
  posterior: number,           // 0-100
  riskReduction: number,       // 0-1: how much risk is reduced by action
  businessDisruption: number,  // 0-1: operational cost of action
): number {
  const p = posterior / 100;
  return Math.max(0, Math.min(1, riskReduction * p - businessDisruption * (1 - p)));
}

/**
 * Poisson anomaly score for a count given expected rate.
 * Returns log-likelihood ratio (higher = more anomalous).
 */
export function poissonAnomalyScore(observed: number, expectedRate: number): number {
  if (expectedRate <= 0) return observed > 0 ? 10 : 0;
  const lambda = Math.max(0.001, expectedRate);
  // LLR = observed * log(observed/lambda) - (observed - lambda)
  if (observed === 0) return 0;
  return Math.max(0, observed * Math.log(observed / lambda) - (observed - lambda));
}

/**
 * Markov surprise: -log P(transition).
 * High surprise = unusual state transition.
 */
export function markovSurprise(transitionProbability: number): number {
  return -Math.log2(Math.max(0.001, transitionProbability));
}

/**
 * Conformal prediction: compute whether observation is within calibrated coverage.
 * alpha = miscoverage rate (e.g., 0.05 for 95% coverage).
 * Returns true if observation is considered an outlier.
 */
export function isConformalAnomaly(score: number, calibratedQuantile: number, alpha = 0.05): boolean {
  // p-value approximation: score > (1-alpha) quantile → anomaly
  return score > calibratedQuantile * (1 - alpha);
}

/**
 * Moving average of last N values.
 */
export function movingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((a, b) => a + b, 0) / window.length;
}

/**
 * Exponential weighted moving average.
 * alpha: smoothing factor (0-1). Higher = more weight on recent.
 */
export function ewma(values: number[], alpha = 0.3): number {
  if (values.length === 0) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}
