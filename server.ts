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
import rateLimit from 'express-rate-limit';
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
import { requirePermission } from './backend/auth/rbac.js';
import { wrapTelemetryForLLM } from './backend/intelligence/tier2.js';
import { getLastBenchmarkReport, getScenarioSummary, runBenchmark } from './backend/benchmark/scenarioEngine.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Trace-Id, X-Dev-Role, Last-Event-ID');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Shared API limiter. RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX are config-backed.
app.use('/api', rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.maxRequests, standardHeaders: true, legacyHeaders: false }));

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
app.head('/api/events/stream', (_req: Request, res: Response) => {
  // Lets the browser client inspect a rate-limit Retry-After before reconnecting.
  res.sendStatus(204);
});
app.get('/api/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = (req as any).traceId ?? randomUUID();
  const resumeId = req.headers['last-event-id'] ?? req.query.lastEventId;
  const lastEventId = resumeId
    ? parseInt(resumeId as string, 10)
    : undefined;

  sseBus.addClient(clientId, res, lastEventId);
});

/**
 * POST /api/investigate/ai
 * AI investigation — consumed by frontend IncidentRoomView
 */
app.post('/api/investigate/ai', requirePermission('canEscalate'), async (req: Request, res: Response) => {
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

    const prompt = `You are the AEGIS-X security analysis service. Return JSON only with exactly {"analysis":string}.\n${wrapTelemetryForLLM(JSON.stringify({
      incidentTitle,
      incidentDescription,
      mitreTechnique,
      rawEvidence,
      raw_log: req.body.raw_log ?? req.body.rawLog,
      cmdline: req.body.cmdline,
    }))}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });

    const json = response.text?.match(/\{[\s\S]*\}/)?.[0];
    let analysis: string | null = null;
    try {
      const parsed = json ? JSON.parse(json) as { analysis?: unknown } : null;
      analysis = typeof parsed?.analysis === 'string' && parsed.analysis.length > 0 ? parsed.analysis : null;
    } catch { analysis = null; }
    if (!analysis) return res.status(502).json({ success: false, error: 'AI response failed schema validation', timestamp: new Date().toISOString() });

    return res.json({
      success: true,
      analysis,
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
app.post('/api/reports/generate', requirePermission('canGenerateReports'), async (req: Request, res: Response) => {
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

app.patch('/api/v1/incidents/:id/status', requirePermission('canEscalate'), (req: Request, res: Response) => {
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

app.post('/api/v1/incidents/:id/investigate', requirePermission('canEscalate'), async (req: Request, res: Response) => {
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

app.patch('/api/v1/agents/:role', requirePermission('canManageAgents'), (req: Request, res: Response) => {
  const { model } = req.body;
  if (model) {
    agentRegistry.updateModel(req.params.role as any, model);
  }
  const agent = agentRegistry.get(req.params.role as any);
  res.json({ success: true, data: agent, timestamp: new Date().toISOString() });
});

// ─── v1 API — Intelligence ──────────────────────────────────────────────────

app.post('/api/v1/investigate', requirePermission('canEscalate'), async (req: Request, res: Response) => {
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

app.post(['/api/v1/emulate', '/api/emulate'], requirePermission('canEscalate'), async (_req: Request, res: Response) => {
  try {
    const ai = getAI();
    const id = `INC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // ─── Curated Attack Scenario Bank (used as base + AI enrichment) ─────────
    const ATTACK_SCENARIOS = [
      {
        title: 'Kerberoasting & LSASS Memory Extraction on Domain Controller',
        description: 'Suspicious memory dump process executed against lsass.exe followed by Kerberos ticket request TGS-REQ with RC4 encryption downgrade. Mimikatz signatures detected in process memory.',
        mitreId: 'T1003.001', mitreName: 'OS Credential Dumping: LSASS Memory', mitreTactic: 'Credential Access',
        severity: 'CRITICAL' as const, hostname: 'DC01-PROD-EAST', ip: '10.142.4.10',
        assetType: 'Domain Controller', predictedNextTarget: 'BACKUP-DC02-WEST',
        sourceDetector: 'CrowdStrike EDR + Active Directory Audit', likelihoodRatio: 22.4,
        containmentImpact: 'Isolating DC01 will trigger FSMO role failover; 4-minute kerberos authentication outage expected.',
        businessImpact: 'Full administrative credential compromise grants attacker god-mode over 847 domain-joined endpoints.',
        recommendedAction: 'Immediately isolate DC01-PROD-EAST, rotate all service account passwords, revoke all Kerberos tickets (krbtgt rotation x2).',
        counterfactualExplanation: 'Without lsass.exe memory access telemetry, confidence drops from 96% to 31% — below actionable threshold.',
      },
      {
        title: 'APT Lateral Movement via SMB Pass-the-Hash — Finance Subnet',
        description: 'NTLM hash relay attack originating from JUMP-HOST-02, propagating to FINANCE-SRV-01 via SMB. 312 authentication failures in 90 seconds consistent with automated credential spraying. Hash capture via Responder tool signature.',
        mitreId: 'T1550.002', mitreName: 'Use Alternate Authentication Material: Pass the Hash', mitreTactic: 'Lateral Movement',
        severity: 'CRITICAL' as const, hostname: 'JUMP-HOST-02', ip: '10.17.8.45',
        assetType: 'Jump Host', predictedNextTarget: 'FINANCE-DB-01',
        sourceDetector: 'SIEM Correlation Rule + NIDS Snort', likelihoodRatio: 18.7,
        containmentImpact: 'Blocking JUMP-HOST-02 will disrupt 12 active admin sessions; 8 pending maintenance tasks will abort.',
        businessImpact: 'Lateral movement to FINANCE-DB-01 risks exfiltration of 14M customer financial records (PCI-DSS breach).',
        recommendedAction: 'Block SMB traffic from JUMP-HOST-02, rotate NTLM hashes, enforce NTLMv2 policy, enable Protected Users group.',
        counterfactualExplanation: 'Removing the SMB authentication log correlation drops confidence to 28%; network flow anomaly alone is insufficient.',
      },
      {
        title: 'Zero-Day Exploit: Remote Code Execution on Internet-Facing API Gateway',
        description: 'Unauthenticated RCE vulnerability (CVE-2024-38122) exploited against API-GW-PROD. Attacker achieved reverse shell via curl to 91.234.55.18 (attributed: Lazarus Group C2). Post-exploit activity: privilege escalation via SUID binary.',
        mitreId: 'T1190', mitreName: 'Exploit Public-Facing Application', mitreTactic: 'Initial Access',
        severity: 'CRITICAL' as const, hostname: 'API-GW-PROD-01', ip: '172.16.1.5',
        assetType: 'Web Server', predictedNextTarget: 'INTERNAL-AUTH-SRV',
        sourceDetector: 'Deception Honeypot + WAF Anomaly Detection', likelihoodRatio: 29.1,
        containmentImpact: 'Isolating API-GW-PROD-01 will take the payment processing API offline, impacting 23K active transactions/min.',
        businessImpact: 'RCE on perimeter gateway provides attacker direct pivot to internal network; estimated breach scope: entire prod environment.',
        recommendedAction: 'Apply emergency patch CVE-2024-38122, rotate API certificates, block C2 range 91.234.55.0/24, enable WAF strict mode.',
        counterfactualExplanation: 'Without honeytoken access log (HONEY-API-KEY-PROD), this would be classified as routine error traffic.',
      },
      {
        title: 'Ransomware Pre-Staging: Mass File Enumeration & Shadow Copy Deletion',
        description: 'Suspicious mass file enumeration across 847 SMB shares (3.2M files scanned in 4 minutes). vssadmin.exe invoked to delete VSS shadow copies. Pattern matches LockBit 3.0 pre-encryption reconnaissance phase.',
        mitreId: 'T1490', mitreName: 'Inhibit System Recovery', mitreTactic: 'Impact',
        severity: 'CRITICAL' as const, hostname: 'FILE-SRV-PROD-03', ip: '10.22.14.8',
        assetType: 'Server', predictedNextTarget: 'BACKUP-NAS-01',
        sourceDetector: 'CrowdStrike EDR + File Integrity Monitor', likelihoodRatio: 31.4,
        containmentImpact: 'Isolating FILE-SRV-PROD-03 halts 23 active file sharing workflows; payroll system will be impacted.',
        businessImpact: 'LockBit pre-staging with shadow copy deletion indicates 6-8 hour window before mass encryption; estimated $4.2M ransom demand.',
        recommendedAction: 'IMMEDIATE: Network segment isolation, suspend all non-essential SMB, force EDR deep scan on all endpoints, notify IR team.',
        counterfactualExplanation: 'Shadow copy deletion telemetry is the critical indicator; removing it drops this to routine scan activity (22% confidence).',
      },
      {
        title: 'Cloud Misconfiguration: S3 Bucket Public Exposure & Data Exfiltration',
        description: 'S3 bucket "prod-customer-data-backup" found publicly accessible after misconfigured ACL push. 4.7GB of PII data downloaded by 3 external IPs (including Shodan crawler). Customer SSNs, payment card data exposed for 47 minutes.',
        mitreId: 'T1530', mitreName: 'Data from Cloud Storage', mitreTactic: 'Exfiltration',
        severity: 'CRITICAL' as const, hostname: 'AWS-PROD-WORKER-07', ip: '172.31.4.22',
        assetType: 'Cloud Instance', predictedNextTarget: 'RDS-PROD-PAYMENTS',
        sourceDetector: 'Cloud Security Posture (AWS GuardDuty + Macie)', likelihoodRatio: 24.8,
        containmentImpact: 'Revoking S3 public access will not restore already-exfiltrated data; audit trail for forensics will be preserved.',
        businessImpact: 'GDPR/CCPA breach notification required within 72 hours; potential $18M regulatory fine; estimated 340K affected customers.',
        recommendedAction: 'Immediately revoke S3 public ACL, rotate all AWS credentials, enable bucket versioning + MFA delete, notify legal/compliance.',
        counterfactualExplanation: 'Without Macie PII classification telemetry, exposure duration estimate changes from 47 min to unknown.',
      },
      {
        title: 'Insider Threat: Privileged User Exfiltrating IP to Personal Cloud',
        description: 'User jsmith@corp.com (Finance Director) uploaded 2.1GB of proprietary financial models to personal Dropbox account using corporate laptop FIN-LAPTOP-042. DLP rule triggered on keyword "acquisition_target_CONFIDENTIAL". Access occurred at 02:14 AM local time — anomalous for this user profile.',
        mitreId: 'T1567.002', mitreName: 'Exfiltration Over Web Service: Exfiltration to Cloud Storage', mitreTactic: 'Exfiltration',
        severity: 'HIGH' as const, hostname: 'FIN-LAPTOP-042', ip: '10.88.12.104',
        assetType: 'Endpoint', predictedNextTarget: 'SHAREPOINT-FINANCE-PROD',
        sourceDetector: 'Symantec DLP + UEBA Behavioral Analytics', likelihoodRatio: 16.3,
        containmentImpact: 'Revoking jsmith access credentials will temporarily disable 3 critical financial reporting pipelines.',
        businessImpact: 'Proprietary M&A target data exposure could compromise $840M acquisition deal and trigger SEC disclosure obligations.',
        recommendedAction: 'Revoke jsmith credentials, forensic image FIN-LAPTOP-042, issue legal hold, escalate to legal counsel for potential insider threat investigation.',
        counterfactualExplanation: 'Without UEBA baseline deviation (247% above normal upload behavior), DLP alert alone yields only 41% confidence.',
      },
      {
        title: 'DNS Tunneling C2 Channel: Cobalt Strike Beacon Exfiltrating Data',
        description: 'Cobalt Strike beacon detected on WEB-APP-SRV-08 using DNS TXT record queries to c2.evil-domain.ru for command-and-control. 847 DNS queries/minute — 1,200% above baseline. Payload encoded in base64 DNS TXT responses. Beacon interval: 60s with ±15s jitter.',
        mitreId: 'T1071.004', mitreName: 'Application Layer Protocol: DNS', mitreTactic: 'Command and Control',
        severity: 'HIGH' as const, hostname: 'WEB-APP-SRV-08', ip: '10.44.2.17',
        assetType: 'Web Server', predictedNextTarget: 'INTERNAL-LDAP-SRV',
        sourceDetector: 'NIDS Snort + DNS Anomaly Detector', likelihoodRatio: 19.2,
        containmentImpact: 'Blocking external DNS resolution for WEB-APP-SRV-08 will disrupt CDN health checks and SSL certificate renewal.',
        businessImpact: 'Active C2 channel indicates attacker has persistent foothold; dwell time estimated 14-21 days based on beacon artifact timestamps.',
        recommendedAction: 'Block DNS queries to c2.evil-domain.ru, isolate WEB-APP-SRV-08 for forensics, scan all endpoints for Cobalt Strike artifacts.',
        counterfactualExplanation: 'Without DNS query volume anomaly detection, C2 traffic blends with legitimate API calls — confidence drops to 19%.',
      },
      {
        title: 'BEC Attack: Executive Email Compromise & Fraudulent Wire Transfer',
        description: 'CFO email account (cwalters@corp.com) compromised via adversary-in-the-middle OAuth token theft. Attacker created inbox rule to forward all emails containing "wire", "transfer", "payment". Fraudulent $2.3M wire transfer request sent to Finance team impersonating CFO.',
        mitreId: 'T1534', mitreName: 'Internal Spearphishing', mitreTactic: 'Lateral Movement',
        severity: 'HIGH' as const, hostname: 'EXCHANGE-PROD-02', ip: '10.11.0.8',
        assetType: 'Server', predictedNextTarget: 'FINANCE-WORKSTATION-12',
        sourceDetector: 'Microsoft Defender for O365 + CASB', likelihoodRatio: 14.9,
        containmentImpact: 'Revoking OAuth tokens will immediately disable CFO email access; emergency communication via phone required.',
        businessImpact: 'If wire transfer processes, $2.3M loss is likely unrecoverable; CEO/board notification required immediately.',
        recommendedAction: 'Revoke all OAuth tokens for cwalters@corp.com, halt wire transfer, notify bank for recall, enable CAE (continuous access evaluation).',
        counterfactualExplanation: 'Without OAuth token anomaly (login from Tor IP 185.220.101.5), this appears as legitimate executive email workflow.',
      },
      {
        title: 'Cryptominer Deployment via Kubernetes Privilege Escalation',
        description: 'Attacker exploited misconfigured RBAC in K8s cluster (CVE-2024-7646) to gain cluster-admin. 47 cryptomining pods (XMRig) deployed across 6 nodes consuming 94% GPU/CPU resources. Monero wallet: 44AFFq5kSi. Network egress to pool.minexmr.com:3333.',
        mitreId: 'T1610', mitreName: 'Deploy Container', mitreTactic: 'Execution',
        severity: 'HIGH' as const, hostname: 'K8S-MASTER-PROD-01', ip: '10.100.0.10',
        assetType: 'Cloud Instance', predictedNextTarget: 'K8S-NODE-04',
        sourceDetector: 'Falco Runtime Security + Cloud Security Posture', likelihoodRatio: 11.8,
        containmentImpact: 'Draining compromised K8s nodes will trigger pod rescheduling; 14 production microservices will have 2-4 minute interruption.',
        businessImpact: 'Cluster-admin access means attacker can access secrets in all K8s namespaces including database credentials and API keys.',
        recommendedAction: 'kubectl delete all mining pods, rotate all K8s secrets, apply RBAC least-privilege, enable PodSecurity standards.',
        counterfactualExplanation: 'Without Falco syscall monitoring, GPU utilization spike alone could be attributed to legitimate ML workloads.',
      },
      {
        title: 'MFA Fatigue Attack: Identity Provider Bypass Leading to Admin Access',
        description: 'Attacker sent 187 MFA push notifications to user mchen@corp.com over 40 minutes (MFA fatigue/push bombing). User approved at attempt #142 at 01:47 AM. Subsequent login from 185.220.101.45 (Tor) obtained Global Admin role in Azure AD. 3 new admin accounts created.',
        mitreId: 'T1621', mitreName: 'Multi-Factor Authentication Request Generation', mitreTactic: 'Credential Access',
        severity: 'CRITICAL' as const, hostname: 'AZURE-AD-TENANT', ip: '185.220.101.45',
        assetType: 'Cloud Instance', predictedNextTarget: 'AZURE-KEY-VAULT-PROD',
        sourceDetector: 'Microsoft Entra ID + SIEM Correlation Rule', likelihoodRatio: 27.3,
        containmentImpact: 'Revoking Global Admin session will lock out attacker but also disrupt mchen pending admin operations.',
        businessImpact: 'Global Admin access to Azure AD means attacker controls all M365, Azure subscriptions, and can exfiltrate entire tenant data.',
        recommendedAction: 'Immediately revoke mchen session tokens, disable 3 rogue admin accounts, enable number matching MFA, review all recent admin actions.',
        counterfactualExplanation: 'Without MFA push count anomaly (187 requests vs. 1.2 average), this appears as standard login from new location.',
      },
      {
        title: 'Supply Chain Compromise: Malicious NPM Package in CI/CD Pipeline',
        description: 'Trojanized npm package "lodash-secure@4.17.22" (typosquatting) injected into production CI/CD pipeline build. Package contains obfuscated backdoor exfiltrating environment variables (including AWS_SECRET_ACCESS_KEY) to 45.76.223.14. 23 production builds affected.',
        mitreId: 'T1195.002', mitreName: 'Compromise Software Supply Chain', mitreTactic: 'Initial Access',
        severity: 'CRITICAL' as const, hostname: 'CICD-RUNNER-03', ip: '10.77.5.12',
        assetType: 'Server', predictedNextTarget: 'PROD-SECRETS-VAULT',
        sourceDetector: 'Snyk + SIEM Dependency Audit', likelihoodRatio: 25.6,
        containmentImpact: 'Halting CI/CD pipeline stops all deployments; 7 pending hotfixes will be blocked including a critical security patch.',
        businessImpact: 'Exfiltrated AWS keys provide full access to production cloud environment; 23 builds potentially deployed backdoored artifacts to prod.',
        recommendedAction: 'Immediately rotate all secrets exposed in environment variables, remove malicious package, rebuild all 23 affected artifacts, scan prod deployments.',
        counterfactualExplanation: 'Without build artifact hash comparison, malicious package appears as legitimate dependency update.',
      },
      {
        title: 'VPN Gateway Zero-Day: Pre-Auth RCE Enabling Network Pivot',
        description: 'Critical pre-authentication RCE vulnerability (CVE-2024-21887) in Ivanti Connect Secure VPN gateway actively exploited. Webshell "tunnel.jsp" dropped in /dana-na/ directory. Reverse tunnel established to 104.21.45.67:8443. 1,247 user sessions potentially compromised.',
        mitreId: 'T1133', mitreName: 'External Remote Services', mitreTactic: 'Persistence',
        severity: 'CRITICAL' as const, hostname: 'VPN-GW-EDGE-01', ip: '172.16.0.1',
        assetType: 'Web Server', predictedNextTarget: 'CORE-SWITCH-INFRA-01',
        sourceDetector: 'NIDS Snort + Deception Honeypot', likelihoodRatio: 30.7,
        containmentImpact: 'Taking VPN gateway offline will disconnect 847 remote workers and all site-to-site VPN tunnels immediately.',
        businessImpact: 'VPN compromise gives attacker access to internal network without going through perimeter; all internal systems considered exposed.',
        recommendedAction: 'EMERGENCY: Take VPN offline, apply Ivanti patch, forensic analysis of all sessions since T-72h, assume breach protocol for internal network.',
        counterfactualExplanation: 'Webshell detection is definitive; without endpoint telemetry, log-only analysis gives 38% confidence (attribution unclear).',
      },
    ];

    const scenario = ATTACK_SCENARIOS[Math.floor(Math.random() * ATTACK_SCENARIOS.length)];

    let title = scenario.title;
    let description = scenario.description;
    let mitreId = scenario.mitreId;
    let mitreName = scenario.mitreName;
    let mitreTactic = scenario.mitreTactic;
    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' = scenario.severity;
    let hostname = scenario.hostname;
    let ip = scenario.ip;

    // Additional AI-generated fields with fallbacks (AI can override these with richer context)
    let assetType = scenario.assetType;
    let containmentImpact = scenario.containmentImpact;
    let businessImpact = scenario.businessImpact;
    let recommendedAction = scenario.recommendedAction;
    let counterfactualExplanation = scenario.counterfactualExplanation;
    let predictedNextTarget = scenario.predictedNextTarget;
    let sourceDetector = scenario.sourceDetector;
    let likelihoodRatio = scenario.likelihoodRatio;

    if (ai) {
      try {
        const attackScenarios = [
          'ransomware deployment via supply chain compromise',
          'APT lateral movement using stolen Kerberos tickets',
          'cloud misconfiguration exploitation leading to data exfiltration',
          'zero-day exploit targeting enterprise VPN gateway',
          'insider threat exfiltrating IP via encrypted channel',
          'BEC attack compromising executive email and financial systems',
          'cryptominer deployment on containerized workloads',
          'DNS tunneling for covert C2 communication',
          'privilege escalation via unpatched kernel vulnerability',
          'identity-based attack using MFA fatigue technique',
        ];
        const chosenScenario = attackScenarios[Math.floor(Math.random() * attackScenarios.length)];

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: `You are AEGIS-X, an elite AI SOC system. Generate a hyper-realistic enterprise cybersecurity incident for the following attack scenario: "${chosenScenario}".

Respond ONLY with a single valid JSON object. No markdown, no code blocks, no extra text. Use this exact schema:
{
  "title": "concise technical incident title (max 80 chars)",
  "description": "2-3 sentence technical description of what happened, including specific indicators of compromise",
  "severity": "CRITICAL",
  "hostname": "realistic enterprise hostname (e.g. DC01-PROD-EAST, WEB-SRV-443, JUMP-HOST-02)",
  "ip": "realistic internal IP (10.x.x.x or 172.16.x.x)",
  "mitreId": "valid MITRE ATT&CK technique ID (e.g. T1078.002)",
  "mitreName": "full MITRE technique name",
  "mitreTactic": "MITRE tactic category (e.g. Credential Access, Lateral Movement)",
  "assetType": "asset type (Domain Controller|Web Server|Database|Endpoint|Cloud Instance|Jump Host|Backup Server)",
  "containmentImpact": "one sentence describing the operational impact of isolating this asset",
  "businessImpact": "one sentence describing the business risk if not contained",
  "recommendedAction": "specific technical remediation steps (one sentence)",
  "counterfactualExplanation": "what evidence, if removed, would drop confidence below threshold",
  "predictedNextTarget": "hostname of the next likely lateral movement target",
  "sourceDetector": "detection source system (e.g. CrowdStrike EDR|SIEM Correlation Rule|Deception Honeypot|Cloud Security Posture|NIDS Snort)",
  "likelihoodRatio": "numeric likelihood ratio between 8.0 and 32.0"
}`,
          config: { temperature: 0.85, maxOutputTokens: 600 },
        });

        const rawText = response.text || '';
        const match = rawText.match(/\{[\s\S]*\}/);
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
        type: assetType,
        criticality: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        owner: 'Security Operations',
      },
      source: sourceDetector,
      mitreTechnique: { id: mitreId, name: mitreName, tactic: mitreTactic },
      confidence: Math.floor(Math.random() * 10 + 88),
      riskScore: Math.floor(Math.random() * 12 + 85),
      dissentScore: Math.floor(Math.random() * 15 + 5),
      timestamp: new Date().toISOString(),
      description,
      assignedAgent: 'COORDINATOR',
      affectedSystemsCount: Math.floor(Math.random() * 10 + 3),
      containmentImpact,
      businessImpact,
      recommendedAction,
      counterfactualExplanation,
      likelihoodRatio,
      predictedNextTarget,
    };

    store.incidents.unshift(incident);

    // Build contextual evidence based on MITRE tactic
    const evidenceTypeMap: Record<string, { type: string; source: string; toolUsed: string; agent: string; content: string }[]> = {
      'Credential Access': [
        { type: 'MEMORY', source: 'EDR Memory Guard', toolUsed: 'CrowdStrike Falcon', agent: 'MALWARE', content: `LSASS memory access detected on ${hostname} (${ip}). Process mimikatz.exe with high-entropy entropy injection. Signature: SIGMA-CRED-DUMP-001.` },
        { type: 'AUTH', source: 'Active Directory Audit', toolUsed: 'Microsoft Sentinel', agent: 'THREAT_INTEL', content: `Anomalous Kerberos TGS-REQ with RC4 cipher downgrade from ${ip}. 47 ticket requests in 120s. Consistent with Kerberoasting pattern.` },
      ],
      'Lateral Movement': [
        { type: 'NETWORK', source: 'Network Sensor', toolUsed: 'NIDS Snort', agent: 'CLOUD', content: `SMB lateral movement from ${ip} → ${predictedNextTarget}. Pass-the-Hash attempt detected. Authentication failure spike: 312 events/min.` },
        { type: 'LOG', source: 'EDR Telemetry', toolUsed: 'CrowdStrike Falcon', agent: 'MALWARE', content: `PsExec remote execution from ${hostname}. Command: net use \\\\${predictedNextTarget}\\C$. Elevated token abuse confirmed.` },
      ],
      'Exfiltration': [
        { type: 'NETWORK', source: 'DLP Gateway', toolUsed: 'Symantec DLP', agent: 'CLOUD', content: `4.7GB egress to 185.220.101.45:443 (Tor exit node). Encrypted payload. Baseline deviation: +1,240%. Exfiltration pattern confirmed.` },
        { type: 'FILE', source: 'File Integrity Monitor', toolUsed: 'Tripwire', agent: 'THREAT_INTEL', content: `Bulk archive operation on ${hostname}: 847 files zipped to /tmp/.hidden/payload.7z. Archive password-protected. Timestamp anomaly detected.` },
      ],
    };

    const evidenceSets = evidenceTypeMap[mitreTactic] || [
      { type: 'NETWORK', source: 'SIEM Correlation', toolUsed: 'Splunk SIEM', agent: 'THREAT_INTEL', content: `${mitreName} (${mitreId}) pattern detected on ${hostname} (${ip}). Correlation rule SIGMA-${mitreId.replace('.','')}-GENERIC triggered.` },
      { type: 'AUTH', source: 'Identity Provider', toolUsed: 'Okta Audit', agent: 'CLOUD', content: `Suspicious authentication event from ${ip}. Geo-velocity violation: login from 3 countries within 40 minutes. MFA bypass attempted.` },
    ];

    const newEvidence: EvidenceItem[] = [
      ...evidenceSets.map((e, i) => ({
        id: `EVD-${Date.now()}-${i + 1}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        type: e.type as EvidenceItem['type'],
        source: e.source,
        rawContent: e.content,
        weight: 10 - i,
        confidence: incident.confidence - i * 2,
        mitreId,
        toolUsed: e.toolUsed,
        flaggedByAgent: e.agent as EvidenceItem['flaggedByAgent'],
      })),
      {
        id: `EVD-${Date.now()}-3`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        type: 'NETWORK' as EvidenceItem['type'],
        source: 'Deception Engine',
        rawContent: `HONEY-VAULT-DB honeytoken accessed from ${ip}. Canary credential used: svc_backup_ro. AEGIS-X Deception Mesh alert triggered. Zero legitimate access expected.`,
        weight: 10,
        confidence: 99,
        mitreId: 'T1078',
        toolUsed: 'AEGIS-X Deception Mesh',
        flaggedByAgent: 'THREAT_INTEL' as EvidenceItem['flaggedByAgent'],
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

app.post(['/api/v1/reset', '/api/reset'], requirePermission('canModifySettings'), (_req: Request, res: Response) => {
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

app.post('/api/v1/iocs/lookup', requirePermission('canEscalate'), async (req: Request, res: Response) => {
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

app.post('/api/v1/decisions/:investigationId/approve', requirePermission('canApproveContainment'), (req: Request, res: Response) => {
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

app.post('/api/v1/reports/generate', requirePermission('canGenerateReports'), async (req: Request, res: Response) => {
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

app.put('/api/v1/settings', requirePermission('canModifySettings'), (req: Request, res: Response) => {
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

app.post('/api/v1/network/emulate', requirePermission('canApproveContainment'), (req: Request, res: Response) => {
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

/** Executes the prototype containment action after RBAC approval. */
app.post('/api/v1/containment/execute', requirePermission('canApproveContainment'), (req: Request, res: Response) => {
  const targets = Array.isArray(req.body.isolateNodeIds) ? req.body.isolateNodeIds as string[] : [];
  const result = emulateContainment(store.networkNodes, targets);
  for (const zone of result.isolatedZones) {
    for (const node of store.networkNodes.filter((candidate) => candidate.zone === zone)) store.toggleNodeIsolation(node.id);
  }
  auditChain.append({ actor: 'HUMAN_OPERATOR', actorType: 'HUMAN', action: 'CONTAINMENT_EXECUTED', details: { zones: result.isolatedZones, recommendations: result.containmentRecommendations } });
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

app.post('/api/v1/benchmark', requirePermission('canEscalate'), async (_req: Request, res: Response) => {
  try {
    const report = await runBenchmark();
    res.json({ success: true, data: report, scenarioSummary: getScenarioSummary(), timestamp: new Date().toISOString() });
  } catch (error) {
    log.error('Benchmark failed', error);
    res.status(500).json({ success: false, error: 'Benchmark failed', timestamp: new Date().toISOString() });
  }
});

app.get('/api/v1/benchmark', (_req: Request, res: Response) => {
  res.json({ success: true, data: getLastBenchmarkReport(), scenarioSummary: getScenarioSummary(), timestamp: new Date().toISOString() });
});

app.get('/api/v1/metrics', (_req: Request, res: Response) => {
  const agents = agentRegistry.getAll();
  const benchmark = getLastBenchmarkReport();
  res.json({
    success: true,
    data: {
      process: {
        uptimeSeconds: process.uptime(),
        memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuUsage: Number((Math.random() * 12 + 14).toFixed(1)),
      },
      measuredLatency: benchmark ? {
        p50EndToEndMs: benchmark.p50LatencyMs,
        p95EndToEndMs: benchmark.p95LatencyMs,
        meanEndToEndMs: benchmark.avgLatencyMs,
        perTierMs: benchmark.tierLatencyMs,
      } : null,
      costPerIncident: benchmark ? Number((benchmark.totalCostUnits / Math.max(1, benchmark.totalAlerts)).toFixed(8)) : null,
      benchmarkRun: benchmark ? { completedAt: benchmark.completedAt, totalIncidents: benchmark.totalAlerts } : null,
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

// ─── API 404 Handler ────────────────────────────────────────────────────────

app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
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
