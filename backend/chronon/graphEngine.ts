/**
 * AEGIS-X Backend — Chronon Prediction Engine
 * Network graph with Laplacian propagation, lateral movement simulation,
 * compromise probability forecasting.
 */

import type { NetworkNode, RiskForecast } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('chronon:engine');

// Adjacency weights between node types (propagation likelihood)
const ADJACENCY_WEIGHTS: Record<string, Record<string, number>> = {
  GATEWAY:        { SERVER: 0.9, WORKSTATION: 0.7, DATABASE: 0.6, CLOUD_INSTANCE: 0.8, CONTAINER: 0.5 },
  SERVER:         { DATABASE: 0.8, WORKSTATION: 0.6, CLOUD_INSTANCE: 0.7, CONTAINER: 0.6, GATEWAY: 0.4 },
  WORKSTATION:    { SERVER: 0.5, DATABASE: 0.3, CLOUD_INSTANCE: 0.4, CONTAINER: 0.3, GATEWAY: 0.3 },
  DATABASE:       { SERVER: 0.4, WORKSTATION: 0.2, CLOUD_INSTANCE: 0.5, CONTAINER: 0.3, GATEWAY: 0.2 },
  CLOUD_INSTANCE: { SERVER: 0.7, DATABASE: 0.6, CONTAINER: 0.8, WORKSTATION: 0.4, GATEWAY: 0.5 },
  CONTAINER:      { SERVER: 0.6, DATABASE: 0.5, CLOUD_INSTANCE: 0.7, WORKSTATION: 0.3, GATEWAY: 0.4 },
};

function getEdgeWeight(fromType: string, toType: string): number {
  return ADJACENCY_WEIGHTS[fromType]?.[toType] ?? 0.3;
}

function riskLevelToScore(level: NetworkNode['riskLevel']): number {
  return { CLEAN: 5, WARNING: 35, DANGER: 65, CRITICAL: 95 }[level] ?? 20;
}

export interface PropagationResult {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  currentRisk: number;
  forecastedRisk: number;
  propagationStep: number;
  estimatedCompromiseAt?: string;
}

/**
 * Simulate lateral movement propagation from compromised nodes.
 * Uses simplified graph Laplacian diffusion.
 */
export function simulatePropagation(
  nodes: NetworkNode[],
  steps = 5,
  timeStepMinutes = 15
): PropagationResult[] {
  // Build risk state vector
  const riskVector = new Map<string, number>(
    nodes.map((n) => [n.id, riskLevelToScore(n.riskLevel)])
  );

  // Mark initially compromised nodes
  const initiallyCompromised = nodes.filter((n) => n.status === 'COMPROMISED' || n.riskLevel === 'CRITICAL');

  // Run diffusion steps
  for (let step = 0; step < steps; step++) {
    const newRisk = new Map<string, number>(riskVector);

    for (const node of nodes) {
      if (node.status === 'ISOLATED' || node.status === 'SIMULATED_ISOLATION') continue;

      let inflow = 0;
      for (const source of initiallyCompromised) {
        const weight = getEdgeWeight(source.type, node.type);
        const sourceRisk = riskVector.get(source.id) ?? 0;
        inflow += sourceRisk * weight * 0.15; // diffusion coefficient
      }

      const current = riskVector.get(node.id) ?? 0;
      newRisk.set(node.id, Math.min(100, current + inflow));
    }

    for (const [id, risk] of newRisk.entries()) {
      riskVector.set(id, risk);
    }
  }

  return nodes.map((node) => {
    const current = riskLevelToScore(node.riskLevel);
    const forecasted = Math.round(riskVector.get(node.id) ?? current);
    const propagationStep = node.propagationStep ?? 0;

    // Estimate compromise time if risk > 80%
    const estimatedCompromiseAt = forecasted > 80
      ? new Date(Date.now() + timeStepMinutes * 60_000 * Math.max(1, (100 - forecasted) / 20)).toISOString()
      : undefined;

    return {
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      currentRisk: current,
      forecastedRisk: forecasted,
      propagationStep,
      estimatedCompromiseAt,
    };
  });
}

/**
 * Generate risk field forecasts for dashboard.
 */
export function generateRiskForecasts(
  nodes: NetworkNode[]
): RiskForecast[] {
  const propagation = simulatePropagation(nodes);

  return propagation.map((p) => ({
    timestamp: new Date().toISOString(),
    nodeId: p.nodeId,
    nodeLabel: p.nodeLabel,
    currentRisk: p.currentRisk,
    forecastedRisk: p.forecastedRisk,
    propagationVelocity: Math.max(0, p.forecastedRisk - p.currentRisk) / 60, // risk units per minute
    estimatedCompromiseAt: p.estimatedCompromiseAt,
    interventionRecommendation:
      p.forecastedRisk > 80
        ? `URGENT: Isolate ${p.nodeLabel} immediately to prevent cascade.`
        : p.forecastedRisk > 50
        ? `MONITOR: Apply network segmentation to ${p.nodeLabel}.`
        : `NOMINAL: No immediate action required for ${p.nodeLabel}.`,
  }));
}
