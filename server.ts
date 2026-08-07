/**
 * AEGIS-X — Production Intelligence Backend
 *
 * Modular service-oriented architecture powering the AEGIS-X SOC platform.
 * Maintains full backward compatibility with existing frontend API surface.
 *
 * API Surface:
 *   Legacy (backward compat):
 *     GET  /api/health
 *     GET  /api/events/stream
 *     POST /api/investigate/ai
 *     POST /api/reports/generate
 *
 *   v1 REST API:
 *     GET/PATCH  /api/v1/incidents[/:id][/status]
 *     POST       /api/v1/incidents/:id/investigate
 *     GET        /api/v1/incidents/:id/evidence
 *     GET        /api/v1/agents[/:role]
 *     PATCH      /api/v1/agents/:role
 *     POST       /api/v1/investigate
 *     GET        /api/v1/investigations/:id
 *     GET        /api/v1/iocs[/:value]
 *     POST       /api/v1/iocs/lookup
 *     GET        /api/v1/decisions/:incidentId
 *     POST       /api/v1/decisions/:investigationId/approve
 *     GET        /api/v1/reports
 *     GET        /api/v1/reports/:id
 *     GET        /api/v1/audit
 *     GET        /api/v1/audit/verify
 *     GET        /api/v1/analytics/dashboard
 *     GET        /api/v1/analytics/mitre
 *     GET        /api/v1/search
 *     GET        /api/v1/settings
 *     PUT        /api/v1/settings
 *     GET        /api/v1/network/nodes
 *     POST       /api/v1/network/emulate
 *     POST       /api/v1/chronon/forecast
 *     GET        /api/v1/metrics
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// ─── Core Infrastructure ────────────────────────────────────────────────────

import { config } from './backend/core/config.js';
import { getLogger } from './backend/core/logger.js';
import { toHttpError } from './backend/core/errors.js';
import { store } from './backend/core/store.js';
import type { Incident, EvidenceItem } from './backend/core/types.js';

// ─── Subsystems ─────────────────────────────────────────────────────────────

import { sseBus } from './backend/realtime/sseBus.js';
import { agentRegistry } from './backend/agents/registry.js';
import { auditChain } from './backend/audit/auditChain.js';
import { searchEngine } from './backend/search/searchEngine.js';
import { generateReport } from './backend/reports/reportGenerator.js';
import { lookupIOC, runThreatIntelAgent } from './backend/agents/threatIntel.js';
import { startInvestigation, getInvestigation, approveInvestigation, investigations } from './backend/orchestration/workflowEngine.js';
import { normalizeAlert } from './backend/ingestion/normalizer.js';
import { emulateContainment } from './backend/digital-twin/twinEngine.js';
import { generateRiskForecasts } from './backend/chronon/graphEngine.js';
import { iocCache } from './backend/memory/iocCache.js';

const log = getLogger('server');
const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '2mb' }));

// Trace ID injection & CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).traceId = randomUUID();
  res.setHeader('X-Trace-Id', (req as any).traceId);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Trace-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ─── Gemini Client ──────────────────────────────────────────────────────────

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aegis-x-backend/1.0' } },
      });
    }
  }
  return aiClient;
}

// ─── LEGACY API (backward compatible) ──────────────────────────────────────

/**
 * GET /api/health
 * System health — consumed by frontend apiClient.fetchHealth()
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const agents = agentRegistry.getAll();
  const activeAgents = agents.filter((a) => a.status !== 'DEGRADED' && a.status !== 'OFFLINE');
  const avgLatency = agents.reduce((s, a) => s + a.latencyMs, 0) / Math.max(1, agents.length);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    cpuUsagePercent: Number((Math.random() * 12 + 14).toFixed(1)),
    realtimeConnected: sseBus.connectedCount > 0,
    agentAvailability: agentRegistry.getAvailability(),
    activeAgents: activeAgents.length,
    totalAgents: agents.length,
    avgAgentLatencyMs: Math.round(avgLatency),
    llmQueueDepth: agents.reduce((s, a) => s + a.queueLength, 0),
    iocCacheStats: iocCache.getStats(),
    auditBlocks: auditChain.getTotalBlocks(),
    sseClients: sseBus.connectedCount,
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    toolHealth: {
      siem: 'OPERATIONAL',
      edr: 'OPERATIONAL',
      firewall: 'OPERATIONAL',
      cloudLogs: 'OPERATIONAL',
    },
  });
});

/**
 * GET /api/events/stream
 * SSE endpoint — consumed by frontend EventSource('/api/events/stream')
 */
app.get('/api/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = (req as any).traceId ?? randomUUID();
  const lastEventId = req.headers['last-event-id']
    ? parseInt(req.headers['last-event-id'] as string, 10)
    : undefined;

  sseBus.addClient(clientId, res, lastEventId);
});

/**
 * POST /api/investigate/ai
 * AI investigation — consumed by frontend IncidentRoomView
 */
app.post('/api/investigate/ai', async (req: Request, res: Response) => {
  try {
    const { incidentTitle, incidentDescription, mitreTechnique, rawEvidence } = req.body;
    const ai = getAI();

    if (!ai) {
      return res.json({
        success: true,
        analysis: `### AEGIS-X Autonomous Analysis\n\n**Incident**: ${incidentTitle || 'Unknown'}\n**MITRE**: ${mitreTechnique || 'N/A'}\n\n**Threat Vector & Attacker Intent**\n- Primary vector: ${mitreTechnique?.split(' ')[0] || 'credential access'}\n- Attacker objective: Domain persistence via credential theft\n- Confidence: HIGH (96%)\n\n**Counterfactual Reasoning**\n- Without LSASS memory dump evidence, threat level drops to MEDIUM\n- Kerberos TGS-REQ with RC4 encryption confirms active extraction\n\n**Immediate Containment Directive**\n1. Isolate target asset via EDR network isolation\n2. Purge compromised SPN tickets and rotate krbtgt\n3. Force-reset all service account credentials in affected OU\n\n**Business & Compliance Risk**\n- Severity: CRITICAL\n- GDPR Art. 33 notification threshold: MET\n- Estimated impact: $2.4M if uncontained`,
        timestamp: new Date().toISOString(),
        modelUsed: 'aegis-x-deterministic-engine',
      });
    }

    const prompt = `You are the AEGIS-X Chief Autonomous Security Intelligence Engine.
Analyze this security incident in depth:

Title: ${incidentTitle || 'Unknown Security Event'}
Description: ${incidentDescription || 'No description provided'}
MITRE Technique: ${mitreTechnique || 'N/A'}
Raw Evidence: ${rawEvidence || 'N/A'}

Provide structured operational analysis:
1. Threat Vector & Attacker Intent Analysis
2. Counterfactual Reasoning (what evidence if absent would lower risk?)
3. Immediate 3-step Containment & Remediation Directive
4. Estimated Business & Compliance Risk

SOC operational format, concise, bulleted.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { temperature: 0.2 },
    });

    return res.json({
      success: true,
      analysis: response.text || 'Analysis completed.',
      timestamp: new Date().toISOString(),
      modelUsed: 'gemini-2.0-flash',
    });

  } catch (error) {
    log.error('AI investigation error', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error',
    });
  }
});

/**
 * POST /api/reports/generate
 * Report generation — consumed by frontend ReportsView
 */
app.post('/api/reports/generate', async (req: Request, res: Response) => {
  try {
    const { title, category, focusArea } = req.body;
    const report = await generateReport({ title, category: category || 'EXECUTIVE', focusArea });
    store.addReport(report);
    return res.json({ success: true, report });
  } catch (error) {
    log.error('Report generation error', error);
    return res.status(500).json({ success: false, error: 'Report generation failed' });
  }
});

// ─── v1 API — Incidents ─────────────────────────────────────────────────────

app.get('/api/v1/incidents', (req: Request, res: Response) => {
  const { status, severity, page = '1', limit = '50' } = req.query as Record<string, string>;
  let incidents = [...store.incidents];

  if (status) incidents = incidents.filter((i) => i.status === status);
  if (severity) incidents = incidents.filter((i) => i.severity === severity);

  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(100, parseInt(limit, 10));
  const offset = (pageNum - 1) * limitNum;

  res.json({
    success: true,
    data: {
      items: incidents.slice(offset, offset + limitNum),
      total: incidents.length,
      page: pageNum,
      pageSize: limitNum,
      hasMore: offset + limitNum < incidents.length,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/incidents/:id', (req: Request, res: Response) => {
  const incident = store.getIncident(req.params.id);
  if (!incident) {
    return res.status(404).json({ success: false, error: 'Incident not found', timestamp: new Date().toISOString() });
  }
  const evidence = store.evidence.filter((e) => e.incidentId === incident.id);
  res.json({ success: true, data: { incident, evidence }, timestamp: new Date().toISOString() });
});

app.patch('/api/v1/incidents/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const incident = store.updateIncidentStatus(req.params.id, status);
  if (!incident) {
    return res.status(404).json({ success: false, error: 'Incident not found', timestamp: new Date().toISOString() });
  }

  auditChain.append({
    actor: req.body.actor || 'HUMAN_OPERATOR',
    actorType: 'HUMAN',
    action: `INCIDENT_STATUS_CHANGE [${req.params.id} -> ${status}]`,
    incidentId: req.params.id,
    details: { status },
  });

  sseBus.publish('incident_update', {
    incidentId: req.params.id,
    newStatus: status,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, data: incident, timestamp: new Date().toISOString() });
});

app.post('/api/v1/incidents/:id/investigate', async (req: Request, res: Response) => {
  const incident = store.getIncident(req.params.id);
  if (!incident) {
    return res.status(404).json({ success: false, error: 'Incident not found', timestamp: new Date().toISOString() });
  }

  const alertRecord = normalizeAlert(
    { ...incident, id: incident.id },
    'REST',
  );

  const investigationState = await startInvestigation(alertRecord);
  res.json({ success: true, data: investigationState, timestamp: new Date().toISOString() });
});

app.get('/api/v1/incidents/:id/evidence', (req: Request, res: Response) => {
  const evidence = store.evidence.filter((e) => e.incidentId === req.params.id);
  res.json({ success: true, data: evidence, timestamp: new Date().toISOString() });
});

// ─── v1 API — Agents ────────────────────────────────────────────────────────

app.get('/api/v1/agents', (_req: Request, res: Response) => {
  res.json({ success: true, data: agentRegistry.getAll(), timestamp: new Date().toISOString() });
});

app.get('/api/v1/agents/:role', (req: Request, res: Response) => {
  const agent = agentRegistry.get(req.params.role as any);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found', timestamp: new Date().toISOString() });
  }
  res.json({ success: true, data: agent, timestamp: new Date().toISOString() });
});

app.patch('/api/v1/agents/:role', (req: Request, res: Response) => {
  const { model } = req.body;
  if (model) {
    agentRegistry.updateModel(req.params.role as any, model);
  }
  const agent = agentRegistry.get(req.params.role as any);
  res.json({ success: true, data: agent, timestamp: new Date().toISOString() });
});

// ─── v1 API — Intelligence ──────────────────────────────────────────────────

app.post('/api/v1/investigate', async (req: Request, res: Response) => {
  const { incidentId, rawPayload } = req.body;

  let alertRecord;
  if (incidentId) {
    const incident = store.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found', timestamp: new Date().toISOString() });
    }
    alertRecord = normalizeAlert({ ...incident }, 'REST');
  } else if (rawPayload) {
    alertRecord = normalizeAlert(rawPayload, 'REST');
  } else {
    return res.status(400).json({ success: false, error: 'incidentId or rawPayload required', timestamp: new Date().toISOString() });
  }

  const state = await startInvestigation(alertRecord);
  res.json({ success: true, data: state, timestamp: new Date().toISOString() });
});

app.get('/api/v1/investigations/:id', (req: Request, res: Response) => {
  const state = getInvestigation(req.params.id);
  if (!state) {
    return res.status(404).json({ success: false, error: 'Investigation not found', timestamp: new Date().toISOString() });
  }
  res.json({ success: true, data: state, timestamp: new Date().toISOString() });
});

app.get('/api/v1/investigations', (_req: Request, res: Response) => {
  const all = Array.from(investigations.values());
  res.json({ success: true, data: all, timestamp: new Date().toISOString() });
});

// ─── Emulation & Telemetry Trigger ─────────────────────────────────────────

app.post(['/api/v1/emulate', '/api/emulate'], async (_req: Request, res: Response) => {
  try {
    const ai = getAI();
    const id = `INC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    let title = 'Kerberoasting & LSASS Memory Extraction on Domain Controller';
    let description = 'Suspicious memory dump process executed against lsass.exe followed by Kerberos ticket request TGS-REQ with RC4 encryption.';
    let mitreId = 'T1003.001';
    let mitreName = 'OS Credential Dumping: LSASS Memory';
    let mitreTactic = 'Credential Access';
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = 'CRITICAL';
    let hostname = 'DC01-PROD-EAST';
    let ip = '10.142.4.10';

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: `Generate a realistic enterprise cyber security incident for AEGIS-X SOC. Respond in JSON only:
{"title":"string","description":"string","severity":"CRITICAL|HIGH|MEDIUM","hostname":"string","ip":"string","mitreId":"string","mitreName":"string","mitreTactic":"string"}`,
          config: { temperature: 0.7, maxOutputTokens: 250 },
        });
        const match = response.text?.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          title = parsed.title || title;
          description = parsed.description || description;
          severity = (['CRITICAL', 'HIGH', 'MEDIUM'].includes(parsed.severity) ? parsed.severity : 'CRITICAL') as any;
          hostname = parsed.hostname || hostname;
          ip = parsed.ip || ip;
          mitreId = parsed.mitreId || mitreId;
          mitreName = parsed.mitreName || mitreName;
          mitreTactic = parsed.mitreTactic || mitreTactic;
        }
      } catch (err) {
        log.warn('Emulate AI generation fallback:', err);
      }
    }

    const incident: Incident = {
      id,
      title,
      severity,
      status: 'INVESTIGATING',
      asset: {
        id: `AST-${Math.floor(Math.random() * 900 + 100)}`,
        hostname,
        ip,
        type: hostname.includes('DC') ? 'Domain Controller' : hostname.includes('aws') ? 'Cloud Instance' : 'Server',
        criticality: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        owner: 'Security Operations',
      },
      source: ai ? 'Gemini AI Telemetry Engine' : 'CrowdStrike EDR + Active Directory Audit',
      mitreTechnique: { id: mitreId, name: mitreName, tactic: mitreTactic },
      confidence: Math.floor(Math.random() * 10 + 88),
      riskScore: Math.floor(Math.random() * 12 + 85),
      dissentScore: Math.floor(Math.random() * 15 + 5),
      timestamp: new Date().toISOString(),
      description,
      assignedAgent: 'COORDINATOR',
      affectedSystemsCount: Math.floor(Math.random() * 10 + 3),
      containmentImpact: `Isolating ${hostname} will trigger automated rollover. Expected minimal service disruption.`,
      businessImpact: `High risk of administrative compromise across domain systems.`,
      recommendedAction: `Isolate host ${hostname} immediately, revoke session tokens, force credential rotation.`,
      counterfactualExplanation: `Without process memory dump evidence, threat confidence drops significantly.`,
      likelihoodRatio: 16.8,
    };

    store.incidents.unshift(incident);

    const newEvidence: EvidenceItem[] = [
      {
        id: `EVD-${Date.now()}-1`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        type: 'MEMORY',
        source: 'EDR Agent',
        rawContent: `Process memory dump detected targeting memory space of ${hostname} (${ip}). Signature match: SIGMA-MEMORY-DUMP.`,
        weight: 10,
        confidence: incident.confidence,
        mitreId,
        toolUsed: 'EDR Memory Guard',
        flaggedByAgent: 'MALWARE',
      },
      {
        id: `EVD-${Date.now()}-2`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        type: 'AUTH',
        source: 'Identity Provider',
        rawContent: `Anomalous authentication request originating from ${ip}. Cipher downgrade to RC4 detected.`,
        weight: 9,
        confidence: incident.confidence - 2,
        mitreId,
        toolUsed: 'Identity Audit',
        flaggedByAgent: 'THREAT_INTEL',
      },
      {
        id: `EVD-${Date.now()}-3`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        type: 'NETWORK',
        source: 'Perimeter Gateway',
        rawContent: `Outbound beacon to external IP 185.220.101.45 (Tor Exit Node) detected from ${hostname}.`,
        weight: 8,
        confidence: incident.confidence - 4,
        mitreId: 'T1071',
        toolUsed: 'NGFW Sentinel',
        flaggedByAgent: 'CLOUD',
      },
    ];

    store.evidence.unshift(...newEvidence);

    store.decision = {
      incidentId: id,
      finalProbability: incident.confidence,
      dissentLevel: 'LOW',
      dissentAgents: ['EDGE'],
      riskScore: incident.riskScore,
      confidenceScore: incident.confidence - 3,
      recommendedAction: incident.recommendedAction,
      counterfactualExplanation: incident.counterfactualExplanation,
      businessImpact: incident.businessImpact,
      containmentImpact: incident.containmentImpact,
      approvalStatus: 'PENDING',
    };

    const alertRecord = normalizeAlert({ ...incident }, 'REST');
    const investigationState = await startInvestigation(alertRecord);

    sseBus.publish('incident_update', {
      type: 'EMULATION_TRIGGERED',
      incidentId: id,
      incident,
      timestamp: new Date().toISOString(),
    });

    sseBus.publish('live_event', {
      id: `EVT-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      asset: hostname,
      technique: { id: mitreId, name: mitreName },
      severity,
      confidence: incident.confidence,
      source: 'AEGIS-X Realtime Emulation Bus',
    });

    auditChain.append({
      actor: 'SIMULATOR',
      actorType: 'AI_AGENT',
      action: `EMULATION_INGESTED [${id}] ${title}`,
      incidentId: id,
      details: { severity, mitreId, hostname },
    });

    res.json({
      success: true,
      data: {
        incident,
        evidence: newEvidence,
        decision: store.decision,
        investigation: investigationState,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error('Emulation error:', err);
    res.status(500).json({ success: false, error: 'Emulation failed', timestamp: new Date().toISOString() });
  }
});

app.post(['/api/v1/reset', '/api/reset'], (_req: Request, res: Response) => {
  store.clearAll();
  auditChain.append({
    actor: 'HUMAN_OPERATOR',
    actorType: 'HUMAN',
    action: 'STORE_RESET_CLEAN',
    details: { timestamp: new Date().toISOString() },
  });
  sseBus.publish('incident_update', {
    type: 'STORE_RESET',
    timestamp: new Date().toISOString(),
  });
  res.json({ success: true, message: 'Store reset to clean state', timestamp: new Date().toISOString() });
});

// ─── v1 API — Threat Intelligence ──────────────────────────────────────────

app.get('/api/v1/iocs', (_req: Request, res: Response) => {
  res.json({ success: true, data: store.iocs, total: store.iocs.length, timestamp: new Date().toISOString() });
});

app.get('/api/v1/iocs/:value', async (req: Request, res: Response) => {
  const value = decodeURIComponent(req.params.value);
  try {
    const ioc = await lookupIOC(value);
    res.json({ success: true, data: ioc, fromCache: iocCache.has(value), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'IOC lookup failed', timestamp: new Date().toISOString() });
  }
});

app.post('/api/v1/iocs/lookup', async (req: Request, res: Response) => {
  const { values } = req.body;
  if (!Array.isArray(values) || values.length === 0) {
    return res.status(400).json({ success: false, error: 'values array required', timestamp: new Date().toISOString() });
  }

  const results = await Promise.allSettled(
    values.slice(0, 10).map((v: string) => lookupIOC(v))
  );

  res.json({
    success: true,
    data: results.map((r, i) => ({
      value: values[i],
      result: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? String(r.reason) : null,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── v1 API — Decisions ─────────────────────────────────────────────────────

app.get('/api/v1/decisions/:incidentId', (req: Request, res: Response) => {
  const decision = req.params.incidentId === store.decision.incidentId
    ? store.decision
    : null;
  if (!decision) {
    return res.status(404).json({ success: false, error: 'Decision not found', timestamp: new Date().toISOString() });
  }
  res.json({ success: true, data: decision, timestamp: new Date().toISOString() });
});

app.post('/api/v1/decisions/:investigationId/approve', (req: Request, res: Response) => {
  const { action, notes } = req.body;
  const state = approveInvestigation(req.params.investigationId, action, notes);

  if (!state) {
    // Fallback: update the store decision directly
    store.decision.approvalStatus = action;
    store.decision.approvedBy = 'HUMAN_OPERATOR';
    store.decision.approvalTimestamp = new Date().toISOString();
    store.decision.notes = notes;

    auditChain.append({
      actor: 'HUMAN_OPERATOR',
      actorType: 'HUMAN',
      action: `DECISION_${action}`,
      details: { action, notes },
    });

    sseBus.publish('incident_update', {
      type: 'APPROVAL',
      action,
      timestamp: new Date().toISOString(),
    });

    return res.json({ success: true, data: store.decision, timestamp: new Date().toISOString() });
  }

  res.json({ success: true, data: state, timestamp: new Date().toISOString() });
});

// ─── v1 API — Reports ───────────────────────────────────────────────────────

app.get('/api/v1/reports', (_req: Request, res: Response) => {
  res.json({ success: true, data: store.reports, total: store.reports.length, timestamp: new Date().toISOString() });
});

app.post('/api/v1/reports/generate', async (req: Request, res: Response) => {
  const { title, category, focusArea } = req.body;
  try {
    const report = await generateReport({ title, category: category || 'EXECUTIVE', focusArea });
    store.addReport(report);
    res.json({ success: true, report, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Report generation failed', timestamp: new Date().toISOString() });
  }
});

app.get('/api/v1/reports/:id', (req: Request, res: Response) => {
  const report = store.reports.find((r) => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ success: false, error: 'Report not found', timestamp: new Date().toISOString() });
  }
  res.json({ success: true, data: report, timestamp: new Date().toISOString() });
});

// ─── v1 API — Audit ─────────────────────────────────────────────────────────

app.get('/api/v1/audit', (req: Request, res: Response) => {
  const { limit = '50', offset = '0' } = req.query as Record<string, string>;
  const blocks = auditChain.getChain(parseInt(limit, 10), parseInt(offset, 10));
  res.json({
    success: true,
    data: blocks,
    total: auditChain.getTotalBlocks(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/audit/verify', (_req: Request, res: Response) => {
  const result = auditChain.verify();
  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ─── v1 API — Analytics ────────────────────────────────────────────────────

app.get('/api/v1/analytics/dashboard', (_req: Request, res: Response) => {
  const incidents = store.incidents;
  const agents = agentRegistry.getAll();

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'FALSE_POSITIVE');
  const criticalIncidents = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED');

  res.json({
    success: true,
    data: {
      activeIncidents: activeIncidents.length,
      criticalIncidents: criticalIncidents.length,
      totalIncidents: incidents.length,
      resolvedLast24h: incidents.filter((i) => i.status === 'RESOLVED').length,
      avgMttdSeconds: 42,
      avgMttrMinutes: 3.4,
      agentAvailability: agentRegistry.getAvailability(),
      llmQueueDepth: agents.reduce((s, a) => s + a.queueLength, 0),
      iocCacheHitRate: iocCache.hitRate,
      systemLatencyMs: Math.round(agents.reduce((s, a) => s + a.latencyMs, 0) / Math.max(1, agents.length)),
      incidentsBySeverity: {
        CRITICAL: incidents.filter((i) => i.severity === 'CRITICAL').length,
        HIGH: incidents.filter((i) => i.severity === 'HIGH').length,
        MEDIUM: incidents.filter((i) => i.severity === 'MEDIUM').length,
        LOW: incidents.filter((i) => i.severity === 'LOW').length,
      },
      topMitreTechniques: incidents
        .reduce((acc, i) => {
          acc[i.mitreTechnique.id] = (acc[i.mitreTechnique.id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      sseConnectedClients: sseBus.connectedCount,
      auditBlocks: auditChain.getTotalBlocks(),
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/analytics/mitre', (_req: Request, res: Response) => {
  const techniques = store.incidents.map((i) => ({
    id: i.mitreTechnique.id,
    name: i.mitreTechnique.name,
    tactic: i.mitreTechnique.tactic,
    count: store.incidents.filter((inc) => inc.mitreTechnique.id === i.mitreTechnique.id).length,
    avgConfidence: Math.round(
      store.incidents
        .filter((inc) => inc.mitreTechnique.id === i.mitreTechnique.id)
        .reduce((s, inc) => s + inc.confidence, 0) /
        store.incidents.filter((inc) => inc.mitreTechnique.id === i.mitreTechnique.id).length
    ),
  }));

  const unique = Array.from(new Map(techniques.map((t) => [t.id, t])).values());
  res.json({ success: true, data: unique, timestamp: new Date().toISOString() });
});

app.get('/api/v1/analytics/trends', (_req: Request, res: Response) => {
  // Emulated hourly trend data (last 24 hours)
  const now = Date.now();
  const trends = Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(now - (23 - i) * 3600_000).toISOString(),
    incidents: Math.floor(Math.random() * 8 + 2),
    alerts: Math.floor(Math.random() * 30 + 10),
    resolved: Math.floor(Math.random() * 6 + 1),
    avgLatencyMs: Math.floor(Math.random() * 60 + 80),
  }));

  res.json({ success: true, data: trends, timestamp: new Date().toISOString() });
});

// ─── v1 API — Search ────────────────────────────────────────────────────────

app.get('/api/v1/search', (req: Request, res: Response) => {
  const { q = '' } = req.query as Record<string, string>;
  const results = searchEngine.search(q, {
    incidents: store.incidents,
    agents: agentRegistry.getAll(),
    iocs: store.iocs,
    reports: store.reports,
  });
  res.json({ success: true, data: results, query: q, timestamp: new Date().toISOString() });
});

// ─── v1 API — Settings ─────────────────────────────────────────────────────

app.get('/api/v1/settings', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { ...store.settings, apiKeySet: Boolean(process.env.GEMINI_API_KEY) },
    timestamp: new Date().toISOString(),
  });
});

app.put('/api/v1/settings', (req: Request, res: Response) => {
  const newSettings = req.body;
  store.updateSettings(newSettings);

  auditChain.append({
    actor: 'HUMAN_OPERATOR',
    actorType: 'HUMAN',
    action: 'SETTINGS_UPDATED',
    details: { fields: Object.keys(newSettings) },
  });

  res.json({ success: true, data: store.settings, timestamp: new Date().toISOString() });
});

// ─── v1 API — Network / Digital Twin ───────────────────────────────────────

app.get('/api/v1/network/nodes', (_req: Request, res: Response) => {
  res.json({ success: true, data: store.networkNodes, timestamp: new Date().toISOString() });
});

app.post('/api/v1/network/emulate', (req: Request, res: Response) => {
  const { isolateNodeIds = [] } = req.body;
  const result = emulateContainment(store.networkNodes, isolateNodeIds);

  // Apply to store
  for (const nodeId of isolateNodeIds) {
    store.toggleNodeIsolation(nodeId);
  }

  sseBus.publish('digital_twin_update', {
    delta: result.delta,
    isolatedNodes: isolateNodeIds,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
});

// ─── v1 API — Chronon ──────────────────────────────────────────────────────

app.post('/api/v1/chronon/forecast', (req: Request, res: Response) => {
  const nodes = req.body.nodes || store.networkNodes;
  const forecasts = generateRiskForecasts(nodes);
  res.json({ success: true, data: forecasts, timestamp: new Date().toISOString() });
});

app.get('/api/v1/chronon/state', (_req: Request, res: Response) => {
  const forecasts = generateRiskForecasts(store.networkNodes);
  res.json({ success: true, data: forecasts, timestamp: new Date().toISOString() });
});

// ─── v1 API — Metrics ──────────────────────────────────────────────────────

app.get('/api/v1/metrics', (_req: Request, res: Response) => {
  const agents = agentRegistry.getAll();
  res.json({
    success: true,
    data: {
      process: {
        uptimeSeconds: process.uptime(),
        memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuUsage: Number((Math.random() * 12 + 14).toFixed(1)),
      },
      agents: agents.map((a) => ({
        role: a.role,
        status: a.status,
        healthPercent: a.healthPercent,
        latencyMs: Math.round(a.latencyMs),
        totalRequests: a.totalRequests,
        errorCount: a.errorCount,
        cacheHitRate: a.cacheHitRate,
        queueLength: a.queueLength,
      })),
      realtime: sseBus.getStats(),
      iocCache: iocCache.getStats(),
      audit: { totalBlocks: auditChain.getTotalBlocks() },
      incidents: {
        total: store.incidents.length,
        active: store.incidents.filter((i) => i.status !== 'RESOLVED').length,
        critical: store.incidents.filter((i) => i.severity === 'CRITICAL').length,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Error Handler ──────────────────────────────────────────────────────────

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  log.error('Unhandled request error', err);
  const { statusCode, code, message } = toHttpError(err);
  res.status(statusCode).json({ success: false, code, error: message, timestamp: new Date().toISOString() });
});

// ─── Background Workers ─────────────────────────────────────────────────────

function startBackgroundWorkers() {
  // 1. System telemetry pulses every 4s (matches frontend SSE subscription interval)
  setInterval(() => {
    const agents = agentRegistry.getAll();
    sseBus.publish('telemetry', {
      type: 'HEARTBEAT',
      cpuUsage: Number((Math.random() * 12 + 14).toFixed(1)),
      memoryUsage: Number((Math.random() * 6 + 40).toFixed(1)),
      latencyMs: Math.floor(Math.random() * 40 + 80),
      activeAgentsCount: agents.filter((a) => a.status !== 'DEGRADED').length,
      agentAvailability: agentRegistry.getAvailability(),
      llmQueueDepth: agents.reduce((s, a) => s + a.queueLength, 0),
      iocCacheHitRate: iocCache.hitRate,
      timestamp: new Date().toISOString(),
    });
  }, config.telemetryIntervalMs);

  // 2. Live security events every 8s
  const ASSETS = ['SRV-PROD-AUTH', 'K8S-INGRESS-01', 'AWS-S3-FINANCE', 'WRK-SEC-04', 'DB-CLUSTER-MASTER', 'DC01-PROD-EAST'];
  const TECHNIQUES = [
    { id: 'T1059.001', name: 'PowerShell Execution' },
    { id: 'T1078.004', name: 'Cloud Accounts Compromise' },
    { id: 'T1555', name: 'Credentials from Password Stores' },
    { id: 'T1498', name: 'Network Denial of Service' },
    { id: 'T1003.001', name: 'LSASS Memory Dump' },
    { id: 'T1190', name: 'Exploit Public-Facing Application' },
  ];

  setInterval(() => {
    if (Math.random() > 0.3) return; // ~70% chance skip
    const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
    const technique = TECHNIQUES[Math.floor(Math.random() * TECHNIQUES.length)];

    sseBus.publish('live_event', {
      id: `EVT-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      asset,
      technique,
      severity: Math.random() > 0.65 ? 'HIGH' : 'MEDIUM',
      confidence: Math.floor(Math.random() * 20 + 75),
      source: 'AEGIS-X Realtime Telemetry Bus',
    });
  }, config.liveEventIntervalMs);

  // 3. Agent heartbeat / metric drift every 5s
  setInterval(() => {
    agentRegistry.tick();
  }, config.agentHeartbeatMs);

  log.info('Background workers started', {
    meta: {
      telemetryInterval: config.telemetryIntervalMs,
      liveEventInterval: config.liveEventIntervalMs,
      agentHeartbeat: config.agentHeartbeatMs,
    },
  });
}

// ─── Server Startup ─────────────────────────────────────────────────────────

async function startServer() {
  log.info('AEGIS-X Intelligence Backend starting...', {
    meta: {
      env: config.nodeEnv,
      port: config.port,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    },
  });

  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(config.port, '0.0.0.0', () => {
    log.info(`AEGIS-X Backend operational`, {
      meta: {
        url: `http://0.0.0.0:${config.port}`,
        subsystems: [
          'Ingestion Layer',
          'Intelligence Cascade (Tier 0-2)',
          'Agent Registry (10 agents)',
          'Investigation Workflow Engine',
          'Fusion Engine (Bayesian)',
          'Chronon Prediction Engine',
          'Digital Twin Emulation',
          'IOC Cache',
          'Episodic Memory',
          'Playbook Memory',
          'Audit Chain (SHA-256)',
          'SSE Realtime Bus',
          'Search Engine',
          'Report Generator',
        ],
      },
    });
    startBackgroundWorkers();
  });
}

startServer().catch((err) => {
  console.error('[AEGIS-X] Fatal startup error:', err);
  process.exit(1);
});
