/** AEGIS-X Backend — Intelligence Tier 1 statistical conformal gate. */

import type { AlertRecord, Severity } from '../core/types.js';
import { poissonAnomalyScore, markovSurprise, movingAverage } from './fusionMath.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('intelligence:tier1');

const techniqueRates = new Map<string, number[]>([
  ['T1003', [0, 0, 1, 0, 0, 2, 0]], ['T1078', [1, 0, 0, 1, 0, 0, 1]],
  ['T1059', [2, 1, 3, 2, 1, 4, 2]], ['T1530', [0, 0, 0, 1, 0, 0, 0]],
]);

const TRANSITION_PROBS: Record<string, Record<string, number>> = {
  NEW: { TRIAGED: 0.9, FALSE_POSITIVE: 0.1 },
  TRIAGED: { INVESTIGATING: 0.85, FALSE_POSITIVE: 0.15 },
  INVESTIGATING: { CONTAINMENT_PENDING: 0.7, RESOLVED: 0.2, FALSE_POSITIVE: 0.1 },
  CONTAINMENT_PENDING: { CONTAINED: 0.8, ESCALATED: 0.2 },
};

/**
 * Conformal quantile using the finite-sample rank ceil((n + 1)(1 - alpha)).
 * The expression is a 1-based rank; it is clamped to the available array.
 */
export function computeConformalThreshold(calibrationScores: number[], alpha = 0.05): number {
  const scores = calibrationScores.filter(Number.isFinite).sort((a, b) => a - b);
  if (scores.length === 0) throw new Error('Calibration scores must not be empty');
  if (alpha <= 0 || alpha >= 1) throw new Error('alpha must be in (0, 1)');
  const rank = Math.ceil((scores.length + 1) * (1 - alpha));
  return scores[Math.min(scores.length - 1, Math.max(0, rank - 1))];
}

/** Deterministic 300-example calibration set of labelled model confidences. */
export function buildCalibrationScores(): number[] {
  let state = 0x9e3779b9;
  const scores: number[] = [];
  for (let index = 0; index < 300; index++) {
    state = (1664525 * state + 1013904223) >>> 0;
    const predictedConfidence = 0.55 + (state / 0xffffffff) * 0.44;
    const predictedCorrect = index % 20 !== 0;
    const pHatY = predictedCorrect ? predictedConfidence : 1 - predictedConfidence;
    scores.push(1 - pHatY);
  }
  return scores;
}

export const CALIBRATION_SCORES = buildCalibrationScores();
export const CONFORMAL_TAU = computeConformalThreshold(CALIBRATION_SCORES);
log.info('Tier1 conformal threshold initialized', { meta: { calibrationSize: CALIBRATION_SCORES.length, tau: CONFORMAL_TAU } });

function severityIsMediumOrLower(severity: Severity): boolean {
  return severity === 'MEDIUM' || severity === 'LOW' || severity === 'INFO';
}

export interface Tier1Result {
  resolved: boolean;
  anomalyScore: number;
  poissonScore: number;
  markovScore: number;
  conformalAnomaly: boolean;
  confidence: number;
  temporalCluster: boolean;
  verdict: 'HIGH_ANOMALY' | 'MODERATE_ANOMALY' | 'NORMAL' | 'ESCALATE';
  reason: string;
  latencyMs: number;
}

export async function runTier1(alert: AlertRecord): Promise<Tier1Result> {
  const start = Date.now();
  const severity = alert.incident.severity;
  const mitreBase = alert.incident.mitreTechnique.id.split('.')[0];
  const rates = techniqueRates.get(mitreBase) ?? [1, 1, 1, 1, 1, 1, 1];
  const expectedRate = movingAverage(rates, 7);
  const poissonScore = poissonAnomalyScore(rates[rates.length - 1] + 1, expectedRate);
  techniqueRates.set(mitreBase, [...rates.slice(-6), (rates[rates.length - 1] ?? 0) + 1]);

  const transitionProb = TRANSITION_PROBS[alert.incident.status]?.INVESTIGATING ?? 0.5;
  const markovScore = markovSurprise(transitionProb);
  const temporalCluster = poissonScore > 4;
  const compositeScore = Math.min(100, Math.round((poissonScore * 15 + markovScore * 10 + (temporalCluster ? 15 : 0)) * (severity === 'CRITICAL' ? 1.3 : 1)));
  const confidence = Math.min(99, Math.max(1, Math.round(50 + compositeScore * 0.45 + (temporalCluster ? 10 : 0))));
  const nonconformity = 1 - confidence / 100;
  const acceptedLocally = nonconformity <= CONFORMAL_TAU && severityIsMediumOrLower(severity);
  const conformalAnomaly = nonconformity > CONFORMAL_TAU;
  const verdict = acceptedLocally
    ? (compositeScore < 20 ? 'NORMAL' : 'MODERATE_ANOMALY')
    : 'ESCALATE';

  const latencyMs = Date.now() - start;
  log.debug('Tier1 conformal gate result', { traceId: alert.traceId, meta: { verdict, nonconformity, tau: CONFORMAL_TAU, severity, latencyMs } });
  return {
    resolved: acceptedLocally,
    anomalyScore: compositeScore,
    poissonScore: Number(poissonScore.toFixed(2)),
    markovScore: Number(markovScore.toFixed(2)),
    conformalAnomaly,
    confidence,
    temporalCluster,
    verdict,
    reason: `Nonconformity ${(nonconformity).toFixed(3)} ${acceptedLocally ? '<=' : '>'} tau ${CONFORMAL_TAU.toFixed(3)}; severity=${severity}.`,
    latencyMs,
  };
}
