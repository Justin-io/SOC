/** Deterministic 200-incident scenario harness with labelled ground truth. */

import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';
import type { BenchmarkResult } from '../core/types.js';
import { normalizeAlert } from '../ingestion/normalizer.js';
import { startInvestigation, waitForInvestigation } from '../orchestration/workflowEngine.js';
import { runTier0 } from '../intelligence/tier0.js';
import { runTier1 } from '../intelligence/tier1.js';
import { runTier2 } from '../intelligence/tier2.js';
import { agentRegistry } from '../agents/registry.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('benchmark:engine');

export interface ScenarioIncident {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  hostname: string;
  ip: string;
  mitreId: string;
  mitreName: string;
  mitreTactic: string;
  confidence: number;
  groundTruth: { label: 'benign' | 'malicious'; trueTechnique: string };
}

const BENIGN_VARIANTS = [
  { name: 'backup jobs', technique: 'T1078', tactic: 'Persistence' },
  { name: 'patch bursts', technique: 'T1059.001', tactic: 'Execution' },
  { name: 'admin maintenance', technique: 'T1021.002', tactic: 'Lateral Movement' },
  { name: 'port scans that resolve benign', technique: 'T1048', tactic: 'Exfiltration' },
] as const;
const ATTACK_FAMILIES = [
  { name: 'Spearphishing to command execution', technique: 'T1566', tactic: 'Initial Access' },
  { name: 'Valid accounts lateral movement', technique: 'T1078', tactic: 'Defense Evasion' },
  { name: 'PowerShell staging chain', technique: 'T1059.001', tactic: 'Execution' },
  { name: 'DNS command and control chain', technique: 'T1071.004', tactic: 'Command and Control' },
  { name: 'SMB administration chain', technique: 'T1021.002', tactic: 'Lateral Movement' },
  { name: 'Exfiltration over alternative protocol', technique: 'T1048', tactic: 'Exfiltration' },
] as const;

/** 120 benign incidents and 80 multi-stage attack incidents across six families. */
export function generateScenarioIncidents(): ScenarioIncident[] {
  const benign = Array.from({ length: 120 }, (_, index) => {
    const variant = BENIGN_VARIANTS[index % BENIGN_VARIANTS.length];
    return {
      id: `BENIGN-${String(index + 1).padStart(3, '0')}`,
      title: `Resolved benign ${variant.name} variant ${index + 1}`,
      description: `Approved ${variant.name}; telemetry was reconciled with a change record and resolved benign.`,
      severity: index % 5 === 0 ? 'MEDIUM' as const : 'LOW' as const,
      hostname: `BENIGN-HOST-${index % 24}`,
      ip: `10.20.${Math.floor(index / 24)}.${(index % 24) + 10}`,
      mitreId: variant.technique,
      mitreName: variant.name,
      mitreTactic: variant.tactic,
      confidence: 18 + (index % 17),
      groundTruth: { label: 'benign' as const, trueTechnique: variant.technique },
    };
  });
  const malicious = Array.from({ length: 80 }, (_, index) => {
    const family = ATTACK_FAMILIES[index % ATTACK_FAMILIES.length];
    return {
      id: `ATTACK-${String(index + 1).padStart(3, '0')}`,
      title: `${family.name} multi-stage attack ${index + 1}`,
      description: `Multi-stage attack chain: initial foothold, credential access, ${family.name.toLowerCase()}, and attempted data collection.`,
      severity: index % 4 === 0 ? 'CRITICAL' as const : 'HIGH' as const,
      hostname: `ATTACK-HOST-${index % 20}`,
      ip: `172.20.${Math.floor(index / 20)}.${(index % 20) + 10}`,
      mitreId: family.technique,
      mitreName: family.name,
      mitreTactic: family.tactic,
      confidence: 82 + (index % 16),
      groundTruth: { label: 'malicious' as const, trueTechnique: family.technique },
    };
  });
  return [...benign, ...malicious];
}

export const SCENARIO_INCIDENTS = generateScenarioIncidents();
let lastBenchmarkReport: BenchmarkResult | null = null;
const reports = new Map<string, BenchmarkResult>();

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? 0;
}

/** Run every generated incident and calculate measured detection quality and latency. */
export async function runBenchmark(): Promise<BenchmarkResult> {
  const startedAt = new Date().toISOString();
  const allStart = performance.now();
  const tier0Latencies: number[] = [];
  const tier1Latencies: number[] = [];
  const tier2Latencies: number[] = [];
  const endToEndLatencies: number[] = [];
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const incident of SCENARIO_INCIDENTS) {
    const incidentStart = performance.now();
    const alert = normalizeAlert({ ...incident, source: 'BENCHMARK_ENGINE', raw_log: incident.description }, 'SYNTHETIC');
    const t0 = performance.now(); await runTier0(alert); tier0Latencies.push(performance.now() - t0);
    const t1 = performance.now(); await runTier1(alert); tier1Latencies.push(performance.now() - t1);
    const t2 = performance.now(); await runTier2(alert); tier2Latencies.push(performance.now() - t2);
    const state = await startInvestigation(alert);
    const complete = await waitForInvestigation(state.investigationId);
    const predictedMalicious = (complete?.decision?.finalProbability ?? 0) >= 50;
    if (predictedMalicious && incident.groundTruth.label === 'malicious') truePositives++;
    else if (predictedMalicious) falsePositives++;
    else if (incident.groundTruth.label === 'malicious') falseNegatives++;
    endToEndLatencies.push(performance.now() - incidentStart);
  }

  const precision = truePositives / Math.max(1, truePositives + falsePositives);
  const recall = truePositives / Math.max(1, truePositives + falseNegatives);
  const mitreDistribution = SCENARIO_INCIDENTS.reduce((distribution, incident) => {
    distribution[incident.groundTruth.trueTechnique] = (distribution[incident.groundTruth.trueTechnique] ?? 0) + 1;
    return distribution;
  }, {} as Record<string, number>);
  const agentPerformance = Object.fromEntries(agentRegistry.getAll().map((agent) => [agent.role, {
    avgLatencyMs: Math.round(agent.latencyMs),
    successRate: Number((1 - agent.errorCount / Math.max(1, agent.totalRequests)).toFixed(4)),
  }])) as BenchmarkResult['agentPerformance'];
  const result: BenchmarkResult = {
    scenarioId: 'GENERATED-200',
    scenarioName: '200-incident labelled scenario suite',
    startedAt,
    completedAt: new Date().toISOString(),
    totalAlerts: SCENARIO_INCIDENTS.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1Score: Number((2 * precision * recall / Math.max(0.0001, precision + recall)).toFixed(4)),
    avgLatencyMs: Math.round(mean(endToEndLatencies)),
    avgContainmentTimeMs: Math.round(mean(endToEndLatencies)),
    mitreCoveragePercent: Number((Object.keys(mitreDistribution).length / ATTACK_FAMILIES.length * 100).toFixed(1)),
    agentPerformance,
    totalCostUnits: Number(((performance.now() - allStart) / 1000 * 0.001).toFixed(6)),
    tierLatencyMs: { tier0: Number(mean(tier0Latencies).toFixed(2)), tier1: Number(mean(tier1Latencies).toFixed(2)), tier2: Number(mean(tier2Latencies).toFixed(2)), pipeline: Number(mean(endToEndLatencies).toFixed(2)) },
    mitreDistribution,
    p50LatencyMs: Math.round(percentile(endToEndLatencies, 0.5)),
    p95LatencyMs: Math.round(percentile(endToEndLatencies, 0.95)),
  };
  lastBenchmarkReport = result;
  reports.set(result.scenarioId, result);
  log.info('Benchmark completed', { meta: { totalAlerts: result.totalAlerts, precision: result.precision, recall: result.recall, tierLatencyMs: result.tierLatencyMs } });
  return result;
}

export async function startBenchmark(): Promise<string> {
  const id = randomUUID();
  const report = await runBenchmark();
  reports.set(id, report);
  return id;
}
export function getBenchmarkResult(id: string): BenchmarkResult | null { return reports.get(id) ?? null; }
export function getBenchmarkStatus(id: string): string | null { return reports.has(id) ? 'COMPLETED' : null; }
export function getLastBenchmarkReport(): BenchmarkResult | null { return lastBenchmarkReport; }
export function getScenarios(): ScenarioIncident[] { return SCENARIO_INCIDENTS; }
export function getScenarioSummary(): { benign: number; malicious: number; mitreDistribution: Record<string, number> } {
  const mitreDistribution = SCENARIO_INCIDENTS.filter((incident) => incident.groundTruth.label === 'malicious').reduce((distribution, incident) => {
    distribution[incident.groundTruth.trueTechnique] = (distribution[incident.groundTruth.trueTechnique] ?? 0) + 1;
    return distribution;
  }, {} as Record<string, number>);
  return { benign: 120, malicious: 80, mitreDistribution };
}
