/**
 * AEGIS-X Backend — event-sourced, zone-aware digital twin.
 * Device topology remains internal; containment output is expressed by zone.
 */

import type { AlertRecord, DigitalTwinState, NetworkNode, NodeStatus } from '../core/types.js';
import { store } from '../core/store.js';
import { computeWaveRiskField } from '../chronon/graphEngine.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('digital-twin:engine');
const TRANSIENT_EDGE_TTL_MS = 5 * 60_000;

interface TransientEdge {
  fromId: string;
  toId: string;
  expiresAt: number;
  introducedForward: boolean;
  introducedReverse: boolean;
}

const transientEdges = new Map<string, TransientEdge>();

function edgeKey(fromId: string, toId: string): string {
  return [fromId, toId].sort().join('::');
}

function removeConnection(node: NetworkNode, targetId: string): void {
  node.connections = node.connections.filter((id) => id !== targetId);
}

/** Removes telemetry-derived connections whose five-minute TTL has elapsed. */
export function pruneTransientEdges(now = Date.now()): void {
  for (const [key, edge] of transientEdges) {
    if (edge.expiresAt > now) continue;
    const from = store.networkNodes.find((node) => node.id === edge.fromId);
    const to = store.networkNodes.find((node) => node.id === edge.toId);
    if (from && edge.introducedForward) removeConnection(from, edge.toId);
    if (to && edge.introducedReverse) removeConnection(to, edge.fromId);
    transientEdges.delete(key);
  }
}

function findNode(nodes: NetworkNode[], value: unknown): NetworkNode | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return nodes.find((node) => node.id === value || node.label === value || node.ip === value);
}

/**
 * Live-sync the twin from normalized telemetry. Known endpoint observations add
 * a bidirectional topology edge for five minutes, then prune automatically.
 */
export function updateTwinFromTelemetry(alert: AlertRecord): void {
  pruneTransientEdges();
  const raw = alert.rawPayload;
  const source = findNode(store.networkNodes,
    raw.sourceHost ?? raw.source_hostname ?? raw.src_host ?? raw.src_ip ?? raw.sourceIp);
  const destination = findNode(store.networkNodes,
    raw.destinationHost ?? raw.destination_hostname ?? raw.dest_host ?? raw.dest_ip ?? raw.destinationIp)
    ?? findNode(store.networkNodes, alert.incident.asset.hostname)
    ?? findNode(store.networkNodes, alert.incident.asset.ip);
  if (!source || !destination || source.id === destination.id) return;

  const key = edgeKey(source.id, destination.id);
  const existing = transientEdges.get(key);
  if (existing) {
    existing.expiresAt = Date.now() + TRANSIENT_EDGE_TTL_MS;
    return;
  }
  const introducedForward = !source.connections.includes(destination.id);
  const introducedReverse = !destination.connections.includes(source.id);
  if (introducedForward) source.connections.push(destination.id);
  if (introducedReverse) destination.connections.push(source.id);
  transientEdges.set(key, {
    fromId: source.id,
    toId: destination.id,
    expiresAt: Date.now() + TRANSIENT_EDGE_TTL_MS,
    introducedForward,
    introducedReverse,
  });
  log.info('Digital twin telemetry edge applied', { meta: { from: source.id, to: destination.id, ttlMs: TRANSIENT_EDGE_TTL_MS } });
}

function zoneRiskLevel(nodes: NetworkNode[]): NetworkNode['riskLevel'] {
  const rank = { CLEAN: 0, WARNING: 1, DANGER: 2, CRITICAL: 3 } as const;
  return nodes.reduce((highest, node) => rank[node.riskLevel] > rank[highest] ? node.riskLevel : highest, 'CLEAN' as NetworkNode['riskLevel']);
}

/** Collapses device topology to a zone graph for containment ΔRisk decisions. */
export function buildZoneGraph(nodes: NetworkNode[]): NetworkNode[] {
  const byZone = new Map<string, NetworkNode[]>();
  for (const node of nodes) byZone.set(node.zone, [...(byZone.get(node.zone) ?? []), node]);
  const zoneEdges = new Map<string, Set<string>>([...byZone.keys()].map((zone) => [zone, new Set<string>()]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    for (const targetId of node.connections) {
      const target = nodeById.get(targetId);
      if (target && target.zone !== node.zone) zoneEdges.get(node.zone)?.add(target.zone);
    }
  }
  return [...byZone.entries()].map(([zone, members]) => ({
    id: `zone:${zone}`,
    label: zone,
    type: members[0].type,
    ip: '0.0.0.0',
    os: 'logical-zone',
    riskLevel: zoneRiskLevel(members),
    status: members.some((node) => node.status === 'COMPROMISED') ? 'COMPROMISED' : members.some((node) => node.status === 'ISOLATED' || node.status === 'EMULATED_ISOLATION') ? 'EMULATED_ISOLATION' : 'ONLINE',
    vulnerabilitiesCount: members.reduce((sum, node) => sum + node.vulnerabilitiesCount, 0),
    businessValue: members.some((node) => node.businessValue === 'HIGH') ? 'HIGH' : members.some((node) => node.businessValue === 'MEDIUM') ? 'MEDIUM' : 'LOW',
    zone,
    connections: [...(zoneEdges.get(zone) ?? [])].map((targetZone) => `zone:${targetZone}`),
    vulnerabilityScore: Math.max(...members.map((node) => node.vulnerabilityScore)),
  }));
}

function computeAggregateRisk(nodes: NetworkNode[]): number {
  const field = computeWaveRiskField(nodes).field;
  return field.length === 0 ? 0 : Math.round(field.reduce((sum, result) => sum + result.forecastedRisk, 0) / field.length);
}

function countAffectedAssets(nodes: NetworkNode[]): number {
  return computeWaveRiskField(nodes).field.filter((result) => result.forecastedRisk >= 30).length;
}

function estimateVictims(nodes: NetworkNode[]): number {
  const impact = { DATABASE: 500, SERVER: 200, GATEWAY: 1000, WORKSTATION: 50, CLOUD_INSTANCE: 300, CONTAINER: 100 } as const;
  return computeWaveRiskField(nodes).field
    .filter((result) => result.forecastedRisk >= 30)
    .reduce((sum, result) => sum + (impact[result.nodeType as keyof typeof impact] ?? 50), 0);
}

function estimateBusinessCost(victims: number, affectedZones: number): number {
  return victims * 2_000 + affectedZones * 500_000;
}

export interface EmulationDelta {
  baseline: DigitalTwinState;
  emulated: DigitalTwinState;
  delta: { riskReduction: number; victimReduction: number; assetReduction: number; costSavings: number; containmentEffectiveness: number };
  isolatedNodeIds: string[];
  isolatedZones: string[];
  containmentRecommendations: string[];
}

/** Evaluate ΔRisk on G and G-minus-action, both represented as zone graphs. */
export function emulateContainment(nodes: NetworkNode[], isolateNodeIds: string[]): EmulationDelta {
  pruneTransientEdges();
  const isolatedZones = [...new Set(nodes.filter((node) => isolateNodeIds.includes(node.id) || isolateNodeIds.includes(node.zone)).map((node) => node.zone))];
  const productionZones = buildZoneGraph(nodes.map((node) => ({ ...node, connections: [...node.connections] })));
  const emulatedZones = buildZoneGraph(nodes.map((node) => ({
    ...node,
    connections: [...node.connections],
    status: (isolatedZones.includes(node.zone) ? 'EMULATED_ISOLATION' : node.status) as NodeStatus,
  })));
  const riskBefore = computeAggregateRisk(productionZones);
  const riskAfter = computeAggregateRisk(emulatedZones);
  const victimsBefore = estimateVictims(productionZones);
  const victimsAfter = estimateVictims(emulatedZones);
  const assetsBefore = countAffectedAssets(productionZones);
  const assetsAfter = countAffectedAssets(emulatedZones);
  const costBefore = estimateBusinessCost(victimsBefore, assetsBefore);
  const costAfter = estimateBusinessCost(victimsAfter, assetsAfter);
  const containmentCost = isolatedZones.length * 25_000;
  const effectiveness = riskBefore > 0 ? Math.min(100, Math.round(((riskBefore - riskAfter) / riskBefore) * 100)) : 0;
  const sourceZone = productionZones.find((zone) => zone.status === 'COMPROMISED')?.zone;
  const containmentRecommendations = isolatedZones.map((zone) =>
    `isolate ${zone} from ${sourceZone && sourceZone !== zone ? sourceZone : 'connected zones'}`);

  return {
    baseline: { totalRiskBefore: riskBefore, totalRiskAfter: riskBefore, projectedVictimsBefore: victimsBefore, projectedVictimsAfter: victimsBefore, affectedAssetsBefore: assetsBefore, affectedAssetsAfter: assetsBefore, estimatedBusinessCost: costBefore, estimatedContainmentCost: 0, confidence: 85, containmentEffectiveness: 0 },
    emulated: { totalRiskBefore: riskBefore, totalRiskAfter: riskAfter, projectedVictimsBefore: victimsBefore, projectedVictimsAfter: victimsAfter, affectedAssetsBefore: assetsBefore, affectedAssetsAfter: assetsAfter, estimatedBusinessCost: costAfter, estimatedContainmentCost: containmentCost, confidence: 88, containmentEffectiveness: effectiveness },
    delta: { riskReduction: riskBefore - riskAfter, victimReduction: victimsBefore - victimsAfter, assetReduction: assetsBefore - assetsAfter, costSavings: costBefore - costAfter - containmentCost, containmentEffectiveness: effectiveness },
    isolatedNodeIds: isolateNodeIds,
    isolatedZones,
    containmentRecommendations,
  };
}
