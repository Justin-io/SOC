/**
 * AEGIS-X Backend — Chronon Prediction Engine
 * Damped discrete graph-wave propagation over the device or zone topology.
 */

import type { NetworkNode, RiskForecast } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('chronon:engine');
const WAVE_SPEED = 0.8;
const DELTA_TAU = 1;
const DAMPING = 0.1;
const TICKS = 8;

export interface PropagationResult {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  currentRisk: number;
  forecastedRisk: number;
  propagationStep: number;
  estimatedCompromiseAt?: string;
}

export interface WaveRiskField {
  sourceNodeId?: string;
  beta: number;
  field: Array<PropagationResult & { riskField: number }>;
  topVictims: PropagationResult[];
}

function riskLevelToScore(level: NetworkNode['riskLevel']): number {
  return { CLEAN: 5, WARNING: 35, DANGER: 65, CRITICAL: 95 }[level];
}

/** Build A, D, and L = D - A from the explicit network topology. */
export function buildGraphLaplacian(nodes: NetworkNode[]): { adjacency: number[][]; degree: number[][]; laplacian: number[][]; maxDegree: number } {
  const count = nodes.length;
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const adjacency = Array.from({ length: count }, () => Array<number>(count).fill(0));

  for (let from = 0; from < count; from++) {
    if (nodes[from].status === 'ISOLATED' || nodes[from].status === 'EMULATED_ISOLATION') continue;
    for (const targetId of nodes[from].connections) {
      const to = indexById.get(targetId);
      if (to === undefined || from === to || nodes[to].status === 'ISOLATED' || nodes[to].status === 'EMULATED_ISOLATION') continue;
      adjacency[from][to] = 1;
      adjacency[to][from] = 1;
    }
  }

  const degrees = adjacency.map((row) => row.reduce((sum, edge) => sum + edge, 0));
  const degree = Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => row === column ? degrees[row] : 0));
  const laplacian = Array.from({ length: count }, (_, row) =>
    Array.from({ length: count }, (_, column) => degree[row][column] - adjacency[row][column]));
  return { adjacency, degree, laplacian, maxDegree: Math.max(0, ...degrees) };
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

/**
 * Evaluate the documented wave equation and retain the full device-level field.
 * u_next = (2 - gamma)u - (1 - gamma)u_prev - beta(L @ u)
 */
export function computeWaveRiskField(nodes: NetworkNode[]): WaveRiskField {
  if (nodes.length === 0) return { beta: 0, field: [], topVictims: [] };
  const { laplacian, maxDegree } = buildGraphLaplacian(nodes);
  const beta = Math.min((WAVE_SPEED * DELTA_TAU) ** 2, maxDegree > 0 ? 2 / maxDegree : 0);
  const sourceIndex = nodes.findIndex((node) => node.status === 'COMPROMISED');
  const selectedSource = sourceIndex >= 0 ? sourceIndex : nodes.findIndex((node) => node.riskLevel === 'CRITICAL');
  const source = selectedSource >= 0 ? selectedSource : 0;
  let u = Array<number>(nodes.length).fill(0);
  u[source] = 1;
  let previous = u.map((value) => (1 - DAMPING) * value);

  for (let tick = 0; tick < TICKS; tick++) {
    const laplacianU = multiplyMatrixVector(laplacian, u);
    const next = u.map((value, index) =>
      (2 - DAMPING) * value - (1 - DAMPING) * previous[index] - beta * laplacianU[index]);
    if (next.some((value) => !Number.isFinite(value))) {
      log.warn('Chronon wave propagation stopped due to non-finite state', { meta: { tick } });
      break;
    }
    previous = u;
    u = next;
  }

  const field = nodes.map((node, index) => {
    const vulnerabilityWeight = Math.max(0, Math.min(1, node.vulnerabilityScore / 10));
    const riskField = vulnerabilityWeight * Math.max(0, u[index]);
    const forecastedRisk = Math.min(100, Math.round(riskField * 100));
    const estimatedCompromiseAt = forecastedRisk > 80
      ? new Date(Date.now() + Math.max(1, 100 - forecastedRisk) * 60_000).toISOString()
      : undefined;
    return {
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      currentRisk: riskLevelToScore(node.riskLevel),
      forecastedRisk,
      propagationStep: node.propagationStep ?? 0,
      estimatedCompromiseAt,
      riskField,
    };
  });
  const topVictims = [...field]
    .sort((left, right) => right.riskField - left.riskField)
    .slice(0, 5)
    .map(({ riskField: _riskField, ...result }) => result);
  return { sourceNodeId: nodes[source].id, beta, field, topVictims };
}

/** Return the top five victims by argsort(R), preserving the legacy function name. */
export function emulatePropagation(nodes: NetworkNode[], _steps = TICKS, _timeStepMinutes = 15): PropagationResult[] {
  return computeWaveRiskField(nodes).topVictims;
}

/** Generate dashboard forecasts from the five highest graph-wave risk-field values. */
export function generateRiskForecasts(nodes: NetworkNode[]): RiskForecast[] {
  return emulatePropagation(nodes).map((result) => ({
    timestamp: new Date().toISOString(),
    nodeId: result.nodeId,
    nodeLabel: result.nodeLabel,
    currentRisk: result.currentRisk,
    forecastedRisk: result.forecastedRisk,
    propagationVelocity: Math.max(0, result.forecastedRisk - result.currentRisk) / 8,
    estimatedCompromiseAt: result.estimatedCompromiseAt,
    interventionRecommendation: `Contain at zone boundary for ${result.nodeLabel}; review connected logical zones.`,
  }));
}
