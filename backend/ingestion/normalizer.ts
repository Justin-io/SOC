/**
 * AEGIS-X Backend — Alert Normalizer
 * Converts raw telemetry into canonical AlertRecord.
 * Downstream services never know the source.
 */

import { randomUUID } from 'crypto';
import type { AlertRecord, Incident, ProcessingState } from '../core/types.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('ingestion:normalizer');

const KNOWN_ASSETS: Record<string, Partial<Incident['asset']>> = {
  'DC01-PROD-EAST': { id: 'AST-001', type: 'Domain Controller', criticality: 'CRITICAL', owner: 'Identity & Access Team' },
  'aws-prod-data-lake-s3': { id: 'AST-089', type: 'AWS S3 Bucket', criticality: 'CRITICAL', owner: 'Data Engineering' },
  'k8s-worker-node-04': { id: 'AST-104', type: 'Kubernetes Worker Node', criticality: 'HIGH', owner: 'Platform Engineering' },
};

function resolveAsset(hostname: string, ip: string): Incident['asset'] {
  const known = KNOWN_ASSETS[hostname] || {};
  return {
    id: known.id ?? `AST-${Math.floor(Math.random() * 900 + 100)}`,
    hostname,
    ip,
    type: known.type ?? 'Server',
    criticality: known.criticality ?? 'MEDIUM',
    owner: known.owner ?? 'Operations',
  };
}

function detectMitreHints(payload: Record<string, unknown>): string[] {
  const hints: string[] = [];
  const raw = JSON.stringify(payload).toLowerCase();

  if (raw.includes('lsass') || raw.includes('credential')) hints.push('T1003');
  if (raw.includes('kerberos') || raw.includes('tgs-req')) hints.push('T1558.003');
  if (raw.includes('powershell') || raw.includes('ps1')) hints.push('T1059.001');
  if (raw.includes('sts:assumerole') || raw.includes('assumerole')) hints.push('T1078.004');
  if (raw.includes('s3') || raw.includes('exfil')) hints.push('T1530');
  if (raw.includes('beacon') || raw.includes('c2') || raw.includes('cobaltstrike')) hints.push('T1071');
  if (raw.includes('lateral') || raw.includes('smb')) hints.push('T1570');
  if (raw.includes('container') || raw.includes('docker') || raw.includes('k8s')) hints.push('T1611');

  return hints;
}

export type IngestionSourceType = AlertRecord['sourceType'];

/**
 * Normalize any raw telemetry shape into a canonical AlertRecord.
 */
export function normalizeAlert(
  rawPayload: Record<string, unknown>,
  sourceType: IngestionSourceType,
  tenantId = 'GLOBAL_SOC'
): AlertRecord {
  const start = Date.now();
  const traceId = randomUUID();

  // Extract basic fields with fallback
  const id = (rawPayload.id as string) ?? `INC-${Date.now()}`;
  const title = (rawPayload.title as string) ?? (rawPayload.name as string) ?? 'Unnamed Security Event';
  const severity = (rawPayload.severity as AlertRecord['incident']['severity']) ?? 'MEDIUM';
  const hostname = (rawPayload.hostname as string) ?? (rawPayload.asset as string) ?? 'UNKNOWN-HOST';
  const ip = (rawPayload.ip as string) ?? '0.0.0.0';
  const source = (rawPayload.source as string) ?? sourceType;
  const description = (rawPayload.description as string) ?? title;
  const status = (rawPayload.status as AlertRecord['incident']['status']) ?? 'NEW';

  const mitreTechnique: Incident['mitreTechnique'] = {
    id: (rawPayload.mitreId as string) ?? 'T1000',
    name: (rawPayload.mitreName as string) ?? 'Unknown Technique',
    tactic: (rawPayload.mitreTactic as string) ?? 'Unknown',
  };

  const incident: Incident = {
    id,
    title,
    severity,
    status,
    asset: resolveAsset(hostname, ip),
    source,
    mitreTechnique,
    confidence: (rawPayload.confidence as number) ?? Math.floor(Math.random() * 30 + 60),
    riskScore: (rawPayload.riskScore as number) ?? Math.floor(Math.random() * 40 + 50),
    dissentScore: (rawPayload.dissentScore as number) ?? Math.floor(Math.random() * 20),
    timestamp: (rawPayload.timestamp as string) ?? new Date().toISOString(),
    description,
    assignedAgent: (rawPayload.assignedAgent as Incident['assignedAgent']) ?? 'COORDINATOR',
    affectedSystemsCount: (rawPayload.affectedSystemsCount as number) ?? 1,
    containmentImpact: (rawPayload.containmentImpact as string) ?? 'Unknown impact.',
    businessImpact: (rawPayload.businessImpact as string) ?? 'Risk assessment pending.',
    recommendedAction: (rawPayload.recommendedAction as string) ?? 'Investigate and contain.',
    counterfactualExplanation: (rawPayload.counterfactualExplanation as string) ?? 'Insufficient data for counterfactual.',
    likelihoodRatio: (rawPayload.likelihoodRatio as number) ?? 1.0,
  };

  const mitreHints = detectMitreHints(rawPayload);
  const enrichmentLatencyMs = Date.now() - start;

  log.debug('Alert normalized', {
    traceId,
    meta: { incidentId: id, sourceType, mitreHints, enrichmentLatencyMs },
  });

  return {
    traceId,
    correlationId: (rawPayload.correlationId as string) ?? traceId,
    tenantId,
    ingestTimestamp: new Date().toISOString(),
    processingState: 'QUEUED',
    sourceType,
    rawPayload,
    incident,
    mitreHints,
    enrichmentLatencyMs,
  };
}
