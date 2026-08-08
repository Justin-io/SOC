/**
 * AEGIS-X Backend — Investigation Workflow Engine
 * Stateful directed graph execution engine (LangGraph-style).
 * Each investigation is an independent graph run.
 */

import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import type {
  AlertRecord, InvestigationState, InvestigationPlan,
  EvidenceRecord, DecisionIntelligence, AgentRole,
} from '../core/types.js';
import { runThreatIntelAgent } from '../agents/threatIntel.js';
import { runFusionEngine } from '../agents/fusionEngine.js';
import {
  runMalwareAgent, runCloudAgent, runIncidentResponseAgent,
  runComplianceAgent, runEdgeAgent, runDeceptionAgent, runCoordinatorAgent,
  runLogAnalysisAgent, runHumanApprovalAgent,
} from '../agents/specialists.js';
import { agentRegistry } from '../agents/registry.js';
import { auditChain } from '../audit/auditChain.js';
import { episodicMemory } from '../memory/episodicMemory.js';
import { sseBus } from '../realtime/sseBus.js';
import { getLogger } from '../core/logger.js';
import { generateRiskForecasts } from '../chronon/graphEngine.js';
import { store } from '../core/store.js';

const log = getLogger('orchestration:workflow');

// ─── Checkpoint Store ────────────────────────────────────────────────────────

const checkpoints = new Map<string, InvestigationState>();

export function getCheckpoint(id: string): InvestigationState | null {
  return checkpoints.get(id) ?? null;
}

// ─── In-flight investigations ─────────────────────────────────────────────────

const activeInvestigations = new Map<string, InvestigationState>();
export const investigations = activeInvestigations;
const executionPromises = new Map<string, Promise<void>>();

// ─── Plan Generation ──────────────────────────────────────────────────────────

function generatePlan(alert: AlertRecord): InvestigationPlan {
  const severity = alert.incident.severity;
  const mitre = alert.incident.mitreTechnique.id;

  // Every registered specialist contributes evidence for every investigation.
  const agentSequence: AgentRole[] = ['COORDINATOR'];
  const parallelGroups: AgentRole[][] = [[
    'THREAT_INTEL', 'LOG_ANALYSIS', 'MALWARE', 'CLOUD', 'INCIDENT_RESPONSE',
    'COMPLIANCE', 'HUMAN', 'DECEPTION', 'EDGE',
  ]];

  // Human approval required for CRITICAL
  const requiresHumanApproval = severity === 'CRITICAL' || severity === 'HIGH';

  return {
    investigationId: randomUUID(),
    incidentId: alert.incident.id,
    agentSequence,
    parallelGroups,
    terminationConditions: [
      'fusion completed',
      severity === 'CRITICAL' ? 'human_approval_received' : 'auto_approved',
    ],
    fallbackStrategy: 'CONTINUE_WITHOUT_FAILED_AGENT',
    maxDurationMs: 30_000,
    requiresHumanApproval,
    createdAt: new Date().toISOString(),
  };
}

// ─── Agent Execution Map ──────────────────────────────────────────────────────

const AGENT_RUNNERS: Partial<Record<AgentRole, (alert: AlertRecord) => Promise<EvidenceRecord>>> = {
  COORDINATOR: runCoordinatorAgent,
  THREAT_INTEL: runThreatIntelAgent,
  MALWARE: runMalwareAgent,
  CLOUD: runCloudAgent,
  INCIDENT_RESPONSE: runIncidentResponseAgent,
  COMPLIANCE: runComplianceAgent,
  EDGE: runEdgeAgent,
  DECEPTION: runDeceptionAgent,
  LOG_ANALYSIS: runLogAnalysisAgent,
  HUMAN: runHumanApprovalAgent,
};

// ─── Main Workflow Execution ──────────────────────────────────────────────────

export async function startInvestigation(alert: AlertRecord): Promise<InvestigationState> {
  const planStart = performance.now();
  const plan = generatePlan(alert);
  const planDuration = performance.now() - planStart;
  const state: InvestigationState = {
    investigationId: plan.investigationId,
    incidentId: alert.incident.id,
    plan,
    status: 'PLANNING',
    completedAgents: [],
    agentStatuses: {},
    stageDurationsMs: { plan: Math.round(planDuration * 100) / 100 },
    evidenceRecords: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activeInvestigations.set(plan.investigationId, state);
  checkpoints.set(plan.investigationId, { ...state });

  auditChain.append({
    actor: 'AEGIS-X Orchestration Engine',
    actorType: 'SYSTEM',
    action: `INVESTIGATION_STARTED [${alert.incident.id}]`,
    incidentId: alert.incident.id,
    details: { investigationId: plan.investigationId, planAgents: plan.parallelGroups },
  });

  sseBus.publish('investigation_progress', {
    investigationId: plan.investigationId,
    incidentId: alert.incident.id,
    status: 'PLANNING',
    message: 'Investigation plan generated. Dispatching agent roster.',
    agentCount: plan.parallelGroups.flat().length + 1,
    timestamp: new Date().toISOString(),
  });

  // Execute asynchronously without blocking
  const execution = executeWorkflow(alert, state).catch((err) => {
    log.error('Workflow execution error', err, { meta: { investigationId: plan.investigationId } });
    state.status = 'FAILED';
    state.error = err instanceof Error ? err.message : String(err);
    state.updatedAt = new Date().toISOString();
  });
  executionPromises.set(plan.investigationId, execution);

  return state;
}

async function executeWorkflow(alert: AlertRecord, state: InvestigationState): Promise<void> {
  state.status = 'RUNNING';
  state.updatedAt = new Date().toISOString();

  try {
    // Run COORDINATOR first
    const triageStart = performance.now();
    const coordEvidence = await safeRunAgent('COORDINATOR', alert);
    state.evidenceRecords.push(coordEvidence);
    state.completedAgents.push('COORDINATOR');
    state.agentStatuses.COORDINATOR = 'COMPLETED';
    recordStage(state, 'triage', performance.now() - triageStart);
    publishProgress(state, 'COORDINATOR', coordEvidence.confidence);

    // Run parallel groups
    for (const group of state.plan.parallelGroups) {
      const groupAgents = group.filter((r) => r !== 'FUSION_ENGINE');
      if (groupAgents.length === 0) continue;

      // Execute group in parallel
      const fanoutStart = performance.now();
      const results = await Promise.allSettled(
        groupAgents.map((role) => safeRunAgent(role, alert))
      );

      for (let i = 0; i < results.length; i++) {
        const role = groupAgents[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
          state.evidenceRecords.push(result.value);
          state.completedAgents.push(role);
          state.agentStatuses[role] = 'COMPLETED';
          publishProgress(state, role, result.value.confidence);
        } else {
          log.warn(`Agent ${role} failed — continuing investigation`, {
            meta: { error: result.reason?.message },
          });
          // Graceful degradation: continue without this agent
          state.agentStatuses[role] = 'FAILED';
          publishProgress(state, role, 0, 'FAILED_GRACEFUL');
        }
      }

      recordStage(state, 'fanout', performance.now() - fanoutStart);
    }

    const fuseStart = performance.now();
    const decision = await runFusionEngine(alert, state.evidenceRecords);
    recordStage(state, 'fuse', performance.now() - fuseStart);
    state.decision = decision;

    const forecastStart = performance.now();
    generateRiskForecasts(store.networkNodes);
    recordStage(state, 'forecast', performance.now() - forecastStart);

    // Determine final status
    const decideStart = performance.now();
    if (state.plan.requiresHumanApproval) {
      state.status = 'PAUSED_APPROVAL';
      state.pausedAt = new Date().toISOString();

      sseBus.publish('human_approval_request', {
        investigationId: state.investigationId,
        incidentId: state.incidentId,
        decision: {
          finalProbability: decision.finalProbability,
          recommendedAction: decision.recommendedAction,
          riskScore: decision.riskScore,
          dissentLevel: decision.dissentLevel,
        },
        timeoutMs: 300_000,
        timestamp: new Date().toISOString(),
      });

      auditChain.append({
        actor: 'FUSION_ENGINE',
        actorType: 'AI_AGENT',
        action: `INVESTIGATION_PAUSED_AWAITING_HUMAN_APPROVAL [${state.incidentId}]`,
        incidentId: state.incidentId,
        details: { probability: decision.finalProbability, riskScore: decision.riskScore },
      });
    } else {
      state.status = 'COMPLETED';
      state.completedAt = new Date().toISOString();
      episodicMemory.store_investigation(state);
    }
    recordStage(state, 'decide', performance.now() - decideStart);

    state.updatedAt = new Date().toISOString();
    alert.incident.pipelineStageDurationsMs = { ...state.stageDurationsMs };
    checkpoints.set(state.investigationId, { ...state });

    sseBus.publish('investigation_progress', {
      investigationId: state.investigationId,
      incidentId: state.incidentId,
      status: state.status,
      decision: state.decision,
      completedAgents: state.completedAgents,
      timestamp: new Date().toISOString(),
    });

    log.info('Investigation workflow completed', {
      meta: {
        investigationId: state.investigationId,
        incidentId: state.incidentId,
        status: state.status,
        agentsCompleted: state.completedAgents.length,
        finalProbability: decision.finalProbability,
      },
    });

  } catch (err) {
    state.status = 'FAILED';
    state.error = err instanceof Error ? err.message : String(err);
    state.updatedAt = new Date().toISOString();
    log.error('Investigation workflow failed', err);
  }
}

async function safeRunAgent(role: AgentRole, alert: AlertRecord): Promise<EvidenceRecord> {
  const runner = AGENT_RUNNERS[role];
  if (!runner) {
    return {
      agentRole: role,
      confidence: 50,
      likelihoodRatio: 1.0,
      reliabilityWeight: 0.5,
      uncertainty: 0.5,
      evidence: [],
      toolsUsed: [],
      executionTimeMs: 0,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    return await runner(alert);
  } catch (err) {
    log.error(`Agent ${role} threw exception`, err);
    throw err;
  }
}

function publishProgress(
  state: InvestigationState,
  completedAgent: AgentRole,
  confidence: number,
  agentStatus = 'COMPLETED'
): void {
  sseBus.publish('investigation_progress', {
    investigationId: state.investigationId,
    incidentId: state.incidentId,
    status: 'RUNNING',
    completedAgent,
    agentStatus,
    confidence,
    totalCompleted: state.completedAgents.length,
    timestamp: new Date().toISOString(),
  });
}

function recordStage(state: InvestigationState, stage: 'triage' | 'plan' | 'fanout' | 'fuse' | 'forecast' | 'decide', durationMs: number): void {
  state.stageDurationsMs ??= {};
  state.stageDurationsMs[stage] = Math.round(durationMs * 100) / 100;
}

export function getInvestigation(id: string): InvestigationState | null {
  return activeInvestigations.get(id) ?? null;
}

/** Await a complete/paused investigation for benchmark measurement. */
export async function waitForInvestigation(id: string): Promise<InvestigationState | null> {
  await executionPromises.get(id);
  return activeInvestigations.get(id) ?? null;
}

export function approveInvestigation(
  investigationId: string,
  action: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'ESCALATED',
  notes?: string
): InvestigationState | null {
  const state = activeInvestigations.get(investigationId);
  if (!state || !state.decision) return null;

  state.decision.approvalStatus = action;
  state.decision.approvedBy = 'HUMAN_OPERATOR';
  state.decision.approvalTimestamp = new Date().toISOString();
  state.decision.notes = notes;
  state.status = 'COMPLETED';
  state.completedAt = new Date().toISOString();
  state.updatedAt = new Date().toISOString();

  episodicMemory.store_investigation(state);
  checkpoints.set(investigationId, { ...state });

  auditChain.append({
    actor: 'HUMAN_OPERATOR',
    actorType: 'HUMAN',
    action: `INVESTIGATION_DECISION_${action} [${state.incidentId}]`,
    incidentId: state.incidentId,
    details: { investigationId, action, notes },
  });

  sseBus.publish('investigation_progress', {
    investigationId,
    incidentId: state.incidentId,
    status: 'COMPLETED',
    decision: state.decision,
    timestamp: new Date().toISOString(),
  });

  return state;
}
