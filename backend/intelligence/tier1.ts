/**
 * AEGIS-X Backend — Intelligence Tier 1
 * Statistical reasoning. No LLM. Conformal prediction, Poisson anomaly,
 * Markov surprise, temporal clustering. Target: < 200ms.
 */

import type { AlertRecord } from '../core/types.js';
import {
  poissonAnomalyScore,
  markovSurprise,
  isConformalAnomaly,
  movingAverage,
  ewma,
} from './fusionMath.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('intelligence:tier1');

// Rolling window of recent alert rates per technique (simulated)
const techniqueRates = new Map<string, number[]>([
  ['T1003', [0, 0, 1, 0, 0, 2, 0]],
  ['T1078', [1, 0, 0, 1, 0, 0, 1]],
  ['T1059', [2, 1, 3, 2, 1, 4, 2]],
  ['T1530', [0, 0, 0, 1, 0, 0, 0]],
  ['T1611', [0, 0, 1, 0, 0, 0, 1]],
]);

// State transition probabilities (Markov model)
const TRANSITION_PROBS: Record<string, Record<string, number>> = {
  'NEW': { 'TRIAGED': 0.9, 'FALSE_POSITIVE': 0.1 },
  'TRIAGED': { 'INVESTIGATING': 0.85, 'FALSE_POSITIVE': 0.15 },
  'INVESTIGATING': { 'CONTAINMENT_PENDING': 0.7, 'RESOLVED': 0.2, 'FALSE_POSITIVE': 0.1 },
  'CONTAINMENT_PENDING': { 'CONTAINED': 0.8, 'ESCALATED': 0.2 },
};

// Calibrated quantiles for conformal prediction (95th percentile anomaly threshold)
const CALIBRATED_QUANTILES: Record<string, number> = {
  'CRITICAL': 3.2,
  'HIGH': 2.8,
  'MEDIUM': 2.1,
  'LOW': 1.5,
  'INFO': 1.0,
};

export interface Tier1Result {
  resolved: boolean;
  anomalyScore: number;       // 0-100
  poissonScore: number;
  markovScore: number;
  conformalAnomaly: boolean;
  confidence: number;         // 0-100
  temporalCluster: boolean;
  verdict: 'HIGH_ANOMALY' | 'MODERATE_ANOMALY' | 'NORMAL' | 'ESCALATE';
  reason: string;
  latencyMs: number;
}

export async function runTier1(alert: AlertRecord): Promise<Tier1Result> {
  const start = Date.now();
  const severity = alert.incident.severity;
  const mitreBase = alert.incident.mitreTechnique.id.split('.')[0];

  // Poisson anomaly: how unusual is this technique frequency?
  const rates = techniqueRates.get(mitreBase) ?? [1, 1, 1, 1, 1, 1, 1];
  const expectedRate = movingAverage(rates, 7);
  const poissonScore = poissonAnomalyScore(rates[rates.length - 1] + 1, expectedRate);

  // Update rolling window
  techniqueRates.set(mitreBase, [...rates.slice(-6), (rates[rates.length - 1] ?? 0) + 1]);

  // Markov surprise: how unusual is this status transition?
  const currentStatus = alert.incident.status;
  const transitions = TRANSITION_PROBS[currentStatus];
  const transitionProb = transitions?.['INVESTIGATING'] ?? 0.5;
  const markovScore = markovSurprise(transitionProb);

  // Conformal prediction: is anomaly score above calibrated threshold?
  const calibratedQ = CALIBRATED_QUANTILES[severity] ?? 2.0;
  const conformalAnomaly = isConformalAnomaly(poissonScore, calibratedQ, 0.05);

  // Temporal clustering: are multiple alerts arriving in quick succession?
  const temporalCluster = poissonScore > 4.0;

  // Composite anomaly score 0-100
  const compositeScore = Math.min(100, Math.round(
    (poissonScore * 15 + markovScore * 10 + (conformalAnomaly ? 30 : 0)) * (severity === 'CRITICAL' ? 1.3 : 1.0)
  ));

  // Confidence based on available statistical signals
  const confidence = Math.min(95, Math.round(50 + compositeScore * 0.4 + (temporalCluster ? 15 : 0)));

  let verdict: Tier1Result['verdict'];
  let resolved = false;

  if (compositeScore >= 70 || conformalAnomaly) {
    verdict = 'HIGH_ANOMALY';
    resolved = severity !== 'CRITICAL'; // CRITICAL always escalates to full investigation
  } else if (compositeScore >= 40) {
    verdict = 'MODERATE_ANOMALY';
    resolved = false;
  } else if (compositeScore < 20 && !conformalAnomaly) {
    verdict = 'NORMAL';
    resolved = severity === 'LOW' || severity === 'INFO';
  } else {
    verdict = 'ESCALATE';
    resolved = false;
  }

  const latencyMs = Date.now() - start;
  log.debug('Tier1 result', {
    traceId: alert.traceId,
    meta: { verdict, compositeScore, conformalAnomaly, latencyMs },
  });

  return {
    resolved,
    anomalyScore: compositeScore,
    poissonScore: Math.round(poissonScore * 100) / 100,
    markovScore: Math.round(markovScore * 100) / 100,
    conformalAnomaly,
    confidence,
    temporalCluster,
    verdict,
    reason: `Poisson: ${poissonScore.toFixed(2)}, Markov surprise: ${markovScore.toFixed(2)}, Conformal: ${conformalAnomaly}`,
    latencyMs,
  };
}
