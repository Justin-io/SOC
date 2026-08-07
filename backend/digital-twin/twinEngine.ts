/**
 * AEGIS-X Backend — Digital Twin Emulation Engine
 * Clones network topology, applies containment modifications,
 * computes risk delta. Never modifies production state.
 */

import type { NetworkNode, DigitalTwinState, NodeStatus } from '../core/types.js';
import { emulatePropagation } from '../chronon/graphEngine.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('digital-twin:engine');

function computeAggregateRisk(nodes: NetworkNode[]): number {
  const riskMap: Record<string, number> = { CLEAN: 5, WARNING: 30, DANGER: 70, CRITICAL: 95 };
  const weights: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

  let totalWeight = 0;
  let weightedRisk = 0;

  for (const node of nodes) {
    const weight = weights[node.businessValue] ?? 1;
    const risk = riskMap[node.riskLevel] ?? 20;
    weightedRisk += risk * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : Math.round(weightedRisk / totalWeight);
}

function countAffectedAssets(nodes: NetworkNode[]): number {
  return nodes.filter((n) =>
    n.riskLevel === 'CRITICAL' || n.riskLevel === 'DANGER' || n.status === 'COMPROMISED'
  ).length;
}

function estimateVictims(nodes: NetworkNode[]): number {
  // Estimate user impact based on asset types
  const impactMap: Record<NetworkNode['type'], number> = {
    DATABASE: 500,
    SERVER: 200,
    GATEWAY: 1000,
    WORKSTATION: 50,
    CLOUD_INSTANCE: 300,
    CONTAINER: 100,
  };
  return nodes
    .filter((n) => n.riskLevel === 'CRITICAL' || n.riskLevel === 'DANGER')
    .reduce((sum, n) => sum + (impactMap[n.type] ?? 50), 0);
}

function estimateBusinessCost(victims: number, criticalCount: number): number {
  // Simplified: $2,000 per victim + $500k per critical asset
  return victims * 2_000 + criticalCount * 500_000;
}

export interface EmulationDelta {
  baseline: DigitalTwinState;
  emulated: DigitalTwinState;
  delta: {
    riskReduction: number;
    victimReduction: number;
    assetReduction: number;
    costSavings: number;
    containmentEffectiveness: number;
  };
  isolatedNodeIds: string[];
}

/**
 * Run a containment emulation by cloning the network state
 * and applying isolation to selected nodes.
 * Returns delta risk — never modifies production state.
 */
export function emulateContainment(
  nodes: NetworkNode[],
  isolateNodeIds: string[]
): EmulationDelta {
  // Clone — deep copy to ensure no production state mutation
  const productionNodes: NetworkNode[] = nodes.map((n) => ({ ...n }));
  const emulatedNodes: NetworkNode[] = nodes.map((n) => ({
    ...n,
    status: (isolateNodeIds.includes(n.id) ? 'EMULATED_ISOLATION' : n.status) as NodeStatus,
  }));

  // Compute propagation on both
  const productionPropagation = emulatePropagation(productionNodes);
  const emulatedPropagation = emulatePropagation(emulatedNodes);

  // Apply propagation results to risk levels
  const enrichedProduction: NetworkNode[] = productionNodes.map((n) => {
    const prop = productionPropagation.find((p) => p.nodeId === n.id);
    if (!prop) return n;
    return {
      ...n,
      riskLevel: prop.forecastedRisk >= 80 ? 'CRITICAL' :
        prop.forecastedRisk >= 60 ? 'DANGER' :
          prop.forecastedRisk >= 30 ? 'WARNING' : 'CLEAN',
    };
  });

  const enrichedEmulated: NetworkNode[] = emulatedNodes.map((n) => {
    const prop = emulatedPropagation.find((p) => p.nodeId === n.id);
    if (!prop) return n;
    return {
      ...n,
      riskLevel: prop.forecastedRisk >= 80 ? 'CRITICAL' :
        prop.forecastedRisk >= 60 ? 'DANGER' :
          prop.forecastedRisk >= 30 ? 'WARNING' : 'CLEAN',
    };
  });

  const riskBefore = computeAggregateRisk(enrichedProduction);
  const riskAfter = computeAggregateRisk(enrichedEmulated);
  const victimsBefore = estimateVictims(enrichedProduction);
  const victimsAfter = estimateVictims(enrichedEmulated);
  const assetsBefore = countAffectedAssets(enrichedProduction);
  const assetsAfter = countAffectedAssets(enrichedEmulated);
  const costBefore = estimateBusinessCost(victimsBefore, assetsBefore);
  const costAfter = estimateBusinessCost(victimsAfter, assetsAfter);
  const containmentCost = isolateNodeIds.length * 25_000; // $25k per isolation action

  const effectiveness = riskBefore > 0
    ? Math.min(100, Math.round(((riskBefore - riskAfter) / riskBefore) * 100))
    : 0;

  const baseline: DigitalTwinState = {
    totalRiskBefore: riskBefore,
    totalRiskAfter: riskBefore,
    projectedVictimsBefore: victimsBefore,
    projectedVictimsAfter: victimsBefore,
    affectedAssetsBefore: assetsBefore,
    affectedAssetsAfter: assetsBefore,
    estimatedBusinessCost: costBefore,
    estimatedContainmentCost: 0,
    confidence: 85,
    containmentEffectiveness: 0,
  };

  const emulated: DigitalTwinState = {
    totalRiskBefore: riskBefore,
    totalRiskAfter: riskAfter,
    projectedVictimsBefore: victimsBefore,
    projectedVictimsAfter: victimsAfter,
    affectedAssetsBefore: assetsBefore,
    affectedAssetsAfter: assetsAfter,
    estimatedBusinessCost: costBefore,
    estimatedContainmentCost: containmentCost,
    confidence: 88,
    containmentEffectiveness: effectiveness,
  };

  log.info('Digital twin emulation complete', {
    meta: {
      isolatedCount: isolateNodeIds.length,
      riskReduction: riskBefore - riskAfter,
      effectiveness,
    },
  });

  return {
    baseline,
    emulated,
    delta: {
      riskReduction: riskBefore - riskAfter,
      victimReduction: victimsBefore - victimsAfter,
      assetReduction: assetsBefore - assetsAfter,
      costSavings: costBefore - costAfter - containmentCost,
      containmentEffectiveness: effectiveness,
    },
    isolatedNodeIds: isolateNodeIds,
  };
}
