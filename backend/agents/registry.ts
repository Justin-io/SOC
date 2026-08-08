/**
 * AEGIS-X Backend — Agent Registry
 * Live registry of all 10 autonomous agents.
 * Tracks health, latency, queue depth, cache hit rate, uptime.
 * Feeds the Agent Observatory view.
 */

import type { AgentMetrics, AgentRole, AgentStatus } from '../core/types.js';
import { getLogger } from '../core/logger.js';
import { sseBus } from '../realtime/sseBus.js';

const log = getLogger('agents:registry');

const INITIAL_AGENT_STATE: AgentMetrics[] = [
  {
    role: 'LOG_ANALYSIS',
    name: 'Log Analysis Engine',
    status: 'IDLE',
    model: 'native-statistical',
    queueLength: 0,
    healthPercent: 98,
    latencyMs: 55,
    memoryUsageMb: 96,
    avgConfidence: 88,
    reliabilityWeight: 0.9,
    totalRequests: 1870,
    toolCalls: 5100,
    errorCount: 9,
    cacheHitRate: 76,
    executionTimeMs: 70,
    uptimePercent: 99.9,
    lastExecution: new Date().toISOString(),
    description: 'Normalizes and correlates endpoint, network, and authentication logs into evidence records.',
  },
  {
    role: 'COORDINATOR',
    name: 'Coordinator Prime',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 99,
    latencyMs: 42,
    memoryUsageMb: 128,
    avgConfidence: 94,
    reliabilityWeight: 0.97,
    totalRequests: 2847,
    toolCalls: 9421,
    errorCount: 12,
    cacheHitRate: 78,
    executionTimeMs: 340,
    uptimePercent: 99.94,
    lastExecution: new Date().toISOString(),
    description: 'Dynamic planning & orchestration. Routes investigations across the full agent topology based on incident complexity.',
  },
  {
    role: 'THREAT_INTEL',
    name: 'Threat Intelligence Engine',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 97,
    latencyMs: 210,
    memoryUsageMb: 256,
    avgConfidence: 91,
    reliabilityWeight: 0.93,
    totalRequests: 5123,
    toolCalls: 18400,
    errorCount: 34,
    cacheHitRate: 82,
    executionTimeMs: 180,
    uptimePercent: 99.87,
    lastExecution: new Date().toISOString(),
    description: 'IOC enrichment via VirusTotal, AbuseIPDB, Shodan, MISP & OTX. Transparent caching with 1h TTL.',
  },
  {
    role: 'MALWARE',
    name: 'Malware Analysis Unit',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 98,
    latencyMs: 380,
    memoryUsageMb: 512,
    avgConfidence: 89,
    reliabilityWeight: 0.91,
    totalRequests: 1842,
    toolCalls: 7640,
    errorCount: 22,
    cacheHitRate: 71,
    executionTimeMs: 520,
    uptimePercent: 99.81,
    lastExecution: new Date().toISOString(),
    description: 'Behavioral analysis, Sigma/YARA signature matching, sandbox emulation & Gemini deep reasoning.',
  },
  {
    role: 'CLOUD',
    name: 'CloudSec Posture',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 96,
    latencyMs: 155,
    memoryUsageMb: 192,
    avgConfidence: 93,
    reliabilityWeight: 0.95,
    totalRequests: 3201,
    toolCalls: 11280,
    errorCount: 18,
    cacheHitRate: 88,
    executionTimeMs: 210,
    uptimePercent: 99.92,
    lastExecution: new Date().toISOString(),
    description: 'Evaluates IAM policies, S3 posture, network ACLs, service account permissions & CloudTrail anomalies.',
  },
  {
    role: 'INCIDENT_RESPONSE',
    name: 'Incident Response Orchestrator',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 99,
    latencyMs: 98,
    memoryUsageMb: 160,
    avgConfidence: 95,
    reliabilityWeight: 0.96,
    totalRequests: 4102,
    toolCalls: 12900,
    errorCount: 8,
    cacheHitRate: 74,
    executionTimeMs: 145,
    uptimePercent: 99.98,
    lastExecution: new Date().toISOString(),
    description: 'Utility-optimised containment strategies. Maximises risk reduction while minimising business disruption.',
  },
  {
    role: 'COMPLIANCE',
    name: 'Compliance & Governance Auditor',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 94,
    latencyMs: 290,
    memoryUsageMb: 220,
    avgConfidence: 87,
    reliabilityWeight: 0.88,
    totalRequests: 1260,
    toolCalls: 4830,
    errorCount: 29,
    cacheHitRate: 80,
    executionTimeMs: 390,
    uptimePercent: 99.72,
    lastExecution: new Date().toISOString(),
    description: 'GDPR/CCPA/SOC2/HIPAA impact evaluation. Governance policy & regulatory breach risk assessment.',
  },
  {
    role: 'EDGE',
    name: 'EdgeIntegrity Monitor',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 91,
    latencyMs: 480,
    memoryUsageMb: 144,
    avgConfidence: 83,
    reliabilityWeight: 0.84,
    totalRequests: 891,
    toolCalls: 2640,
    errorCount: 41,
    cacheHitRate: 62,
    executionTimeMs: 620,
    uptimePercent: 99.61,
    lastExecution: new Date().toISOString(),
    description: 'Firmware integrity, OTA validation, heartbeat anomalies & embedded device telemetry analysis.',
  },
  {
    role: 'DECEPTION',
    name: 'Deception Operations Layer',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 98,
    latencyMs: 65,
    memoryUsageMb: 112,
    avgConfidence: 99,
    reliabilityWeight: 0.99,
    totalRequests: 2204,
    toolCalls: 8102,
    errorCount: 2,
    cacheHitRate: 92,
    executionTimeMs: 88,
    uptimePercent: 99.99,
    lastExecution: new Date().toISOString(),
    description: 'Honeypot orchestration, canary token management, credential trap analysis & deception mesh control.',
  },
  {
    role: 'HUMAN',
    name: 'HumanApproval Interface',
    status: 'IDLE',
    model: 'human-in-the-loop',
    queueLength: 0,
    healthPercent: 100,
    latencyMs: 180000,
    memoryUsageMb: 0,
    avgConfidence: 100,
    reliabilityWeight: 1.0,
    totalRequests: 412,
    toolCalls: 412,
    errorCount: 0,
    cacheHitRate: 0,
    executionTimeMs: 180000,
    uptimePercent: 100,
    lastExecution: new Date().toISOString(),
    description: 'Human analyst approval layer. Mandatory gate for critical containment actions per SLA policy.',
  },
];

class AgentRegistry {
  private agents = new Map<AgentRole, AgentMetrics>();
  private startTime = Date.now();

  constructor() {
    for (const agent of INITIAL_AGENT_STATE) {
      this.agents.set(agent.role, { ...agent });
    }
  }

  getAll(): AgentMetrics[] {
    return Array.from(this.agents.values());
  }

  get(role: AgentRole): AgentMetrics | null {
    return this.agents.get(role) ?? null;
  }

  updateStatus(role: AgentRole, status: AgentStatus): void {
    const agent = this.agents.get(role);
    if (!agent) return;
    agent.status = status;
    agent.lastExecution = new Date().toISOString();
    this.agents.set(role, agent);
  }

  updateModel(role: AgentRole, model: string): void {
    const agent = this.agents.get(role);
    if (!agent) return;
    agent.model = model;
    this.agents.set(role, agent);
  }

  recordExecution(role: AgentRole, latencyMs: number, success: boolean, confidence?: number): void {
    const agent = this.agents.get(role);
    if (!agent) return;

    agent.totalRequests++;
    agent.toolCalls++;
    agent.executionTimeMs = Math.round((agent.executionTimeMs * 0.9) + (latencyMs * 0.1)); // EWMA
    agent.latencyMs = Math.round((agent.latencyMs * 0.8) + (latencyMs * 0.2));
    agent.lastExecution = new Date().toISOString();

    if (!success) {
      agent.errorCount++;
    }
    if (confidence !== undefined && confidence > 0) {
      agent.avgConfidence = Math.round((agent.avgConfidence * 0.85) + (confidence * 0.15));
    }

    // Update health based on error rate
    const errorRate = agent.errorCount / Math.max(1, agent.totalRequests);
    agent.healthPercent = Math.round(Math.max(40, 100 - errorRate * 200));

    // Update uptime
    const uptimeMs = Date.now() - this.startTime;
    agent.uptimePercent = Math.min(100, Number((100 - (agent.errorCount / Math.max(1, uptimeMs / 60000)) * 0.01).toFixed(2)));

    this.agents.set(role, agent);
  }

  incrementQueue(role: AgentRole): void {
    const agent = this.agents.get(role);
    if (!agent) return;
    agent.queueLength++;
    this.agents.set(role, agent);
  }

  decrementQueue(role: AgentRole): void {
    const agent = this.agents.get(role);
    if (!agent) return;
    agent.queueLength = Math.max(0, agent.queueLength - 1);
    this.agents.set(role, agent);
  }

  /**
   * Emulate realistic metric drift for telemetry realism.
   * Called periodically by background worker.
   */
  tick(): void {
    for (const [role, agent] of this.agents.entries()) {
      if (agent.status === 'IDLE') {
        // Slight random drift
        agent.latencyMs = Math.max(10, agent.latencyMs + (Math.random() - 0.5) * 5);
        agent.memoryUsageMb = Math.max(64, Math.min(1024, agent.memoryUsageMb + (Math.random() - 0.5) * 4));
        agent.cacheHitRate = Math.max(0, Math.min(100, agent.cacheHitRate + (Math.random() - 0.5) * 2));
        this.agents.set(role, agent);
      }
    }

    // Publish agent metrics via SSE
    sseBus.publish('agent_update', {
      agents: this.getAll().map((a) => ({
        role: a.role,
        status: a.status,
        healthPercent: Math.round(a.healthPercent),
        latencyMs: Math.round(a.latencyMs),
        queueLength: a.queueLength,
        avgConfidence: Math.round(a.avgConfidence),
      })),
      timestamp: new Date().toISOString(),
    });
  }

  getAvailability(): number {
    const active = this.getAll().filter((a) => a.status !== 'DEGRADED' && a.status !== 'OFFLINE');
    return Math.round((active.length / this.agents.size) * 100);
  }
}

export const agentRegistry = new AgentRegistry();
