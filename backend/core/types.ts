/**
 * AEGIS-X Backend — Canonical Domain Types
 * Single source of truth for all domain objects.
 * Mirrors src/types/soc.ts exactly, with backend extensions.
 */

// ─── Frontend-mirrored types ───────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type IncidentStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'INVESTIGATING'
  | 'CONTAINMENT_PENDING'
  | 'CONTAINED'
  | 'RESOLVED'
  | 'FALSE_POSITIVE';

export type AgentRole =
  | 'COORDINATOR'
  | 'THREAT_INTEL'
  | 'LOG_ANALYSIS'
  | 'MALWARE'
  | 'CLOUD'
  | 'INCIDENT_RESPONSE'
  | 'COMPLIANCE'
  | 'EDGE'
  | 'DECEPTION'
  | 'HUMAN'
  | 'FUSION_ENGINE';

export type AgentStatus = 'IDLE' | 'ANALYZING' | 'EXECUTING' | 'DEGRADED' | 'OFFLINE';

export interface AssetRecord {
  id: string;
  hostname: string;
  ip: string;
  type: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  owner: string;
}

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  asset: AssetRecord;
  source: string;
  mitreTechnique: MitreTechnique;
  confidence: number;
  riskScore: number;
  dissentScore: number;
  timestamp: string;
  description: string;
  assignedAgent: AgentRole;
  affectedSystemsCount: number;
  containmentImpact: string;
  businessImpact: string;
  recommendedAction: string;
  counterfactualExplanation: string;
  likelihoodRatio: number;
  predictedNextTarget?: string;
  pipelineStageDurationsMs?: Partial<Record<'triage' | 'plan' | 'fanout' | 'fuse' | 'forecast' | 'decide', number>>;
}

export interface AgentMetrics {
  role: AgentRole;
  name: string;
  status: AgentStatus;
  model: string;
  queueLength: number;
  healthPercent: number;
  latencyMs: number;
  memoryUsageMb: number;
  avgConfidence: number;
  reliabilityWeight: number;
  totalRequests: number;
  toolCalls: number;
  errorCount: number;
  cacheHitRate: number;
  executionTimeMs: number;
  uptimePercent: number;
  lastExecution: string;
  description: string;
}

export type EvidenceType = 'LOG' | 'NETWORK' | 'FILE' | 'MEMORY' | 'AUTH' | 'API';

export interface EvidenceItem {
  id: string;
  incidentId: string;
  timestamp: string;
  type: EvidenceType;
  source: string;
  rawContent: string;
  weight: number;
  confidence: number;
  mitreId: string;
  toolUsed: string;
  hash?: string;
  flaggedByAgent: AgentRole;
}

export interface DecisionIntelligence {
  incidentId: string;
  finalProbability: number;
  dissentLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  dissentAgents: AgentRole[];
  riskScore: number;
  confidenceScore: number;
  recommendedAction: string;
  counterfactualExplanation: string;
  businessImpact: string;
  containmentImpact: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'ESCALATED';
  approvedBy?: string;
  approvalTimestamp?: string;
  notes?: string;
}

export type IOCType = 'IP' | 'HASH' | 'DOMAIN' | 'URL' | 'EMAIL';
export type IOCReputation = 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN' | 'UNKNOWN';

export interface IOCItem {
  value: string;
  type: IOCType;
  reputation: IOCReputation;
  confidence: number;
  threatFamily?: string;
  firstSeen: string;
  lastSeen: string;
  mitreMapping: string[];
  virusTotal: {
    malicious: number;
    suspicious: number;
    harmless: number;
    scoreRatio: string;
  };
  abuseIPDB: {
    abuseConfidenceScore: number;
    totalReports: number;
    countryCode: string;
  };
  shodan: {
    ports: number[];
    vulnerabilitiesCount: number;
    isp: string;
    os?: string;
  };
  relatedIncidentsCount: number;
  historicalObservations: number;
}

export type NetworkNodeType = 'WORKSTATION' | 'SERVER' | 'DATABASE' | 'GATEWAY' | 'CLOUD_INSTANCE' | 'CONTAINER';
export type NodeRiskLevel = 'CLEAN' | 'WARNING' | 'DANGER' | 'CRITICAL';
export type NodeStatus = 'ONLINE' | 'ISOLATED' | 'COMPROMISED' | 'EMULATED_ISOLATION';

export interface NetworkNode {
  id: string;
  label: string;
  type: NetworkNodeType;
  ip: string;
  os: string;
  riskLevel: NodeRiskLevel;
  status: NodeStatus;
  vulnerabilitiesCount: number;
  businessValue: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Logical containment zone, e.g. web-tier or db-tier. */
  zone: string;
  /** Device-level adjacency used to build the graph Laplacian. */
  connections: string[];
  /** CVSS base score in [0, 10], used as the wave risk-field weight. */
  vulnerabilityScore: number;
  propagationStep?: number;
}

export interface DigitalTwinState {
  totalRiskBefore: number;
  totalRiskAfter: number;
  projectedVictimsBefore: number;
  projectedVictimsAfter: number;
  affectedAssetsBefore: number;
  affectedAssetsAfter: number;
  estimatedBusinessCost: number;
  estimatedContainmentCost: number;
  confidence: number;
  containmentEffectiveness: number;
}

export interface AuditBlock {
  index: number;
  timestamp: string;
  hash: string;
  previousHash: string;
  actor: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  action: string;
  incidentId?: string;
  verificationStatus: 'VALID' | 'TAMPERED';
  integrityProof: string;
  details: Record<string, unknown>;
}

export type ReportCategory = 'EXECUTIVE' | 'COMPLIANCE' | 'INCIDENT_POST_MORTEM' | 'THREAT_BRIEF' | 'INCIDENT' | 'THREAT_INTEL';
export type ReportStatus = 'READY' | 'GENERATING' | 'FAILED';

export interface SOCReport {
  id: string;
  title: string;
  category: ReportCategory | string;
  generatedAt: string;
  date?: string;
  author: string;
  generatedBy?: string;
  status: ReportStatus;
  summary: string;
  incidentCount?: number;
  fileSizeMb?: number;
  mitreCoveragePercent?: number;
  keyFindings?: string[];
  recommendations?: string[];
  downloadUrl?: string;
}

export interface SOCSettings {
  riskThreshold: number;
  autoContainmentRiskThreshold?: number;
  dissentSensitivityThreshold?: number;
  humanSlaTimeoutMinutes?: number;
  conformalCoverageAlpha?: number;
  dissentSensitivity: 'STRICT' | 'BALANCED' | 'PERMISSIVE';
  autoContainmentEnabled: boolean;
  modelRouting: Record<AgentRole, string>;
  agentEnabled: Record<AgentRole, boolean>;
  rateLimitPerMin: number;
  memoryLimitMb: number;
  apiKeySet: boolean;
  realtimeRefreshIntervalMs: number;
  supabaseStatus: 'CONNECTED' | 'DISCONNECTED' | 'STANDBY';
  featureFlags: {
    experimentalChrononWave: boolean;
    conformalPrediction: boolean;
    autoEvidenceFusion: boolean;
    deceptionHoneyMesh: boolean;
  };
}

export interface SystemHealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  apiStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  agentAvailability: number;
  llmQueueDepth: number;
  realtimeConnected: boolean;
  toolHealth: {
    siem: 'OPERATIONAL' | 'DEGRADED';
    edr: 'OPERATIONAL' | 'DEGRADED';
    firewall: 'OPERATIONAL' | 'DEGRADED';
    cloudLogs: 'OPERATIONAL' | 'DEGRADED';
  };
}

// ─── Backend-only types ─────────────────────────────────────────────────────

export type ProcessingState = 'QUEUED' | 'TIER0' | 'TIER1' | 'TIER2' | 'TIER3' | 'RESOLVED' | 'SUPPRESSED';

export interface AlertRecord {
  traceId: string;
  correlationId: string;
  tenantId: string;
  ingestTimestamp: string;
  processingState: ProcessingState;
  sourceType: 'SIEM' | 'EDR' | 'CLOUD' | 'MQTT' | 'CSV' | 'REST' | 'WEBSOCKET' | 'SYNTHETIC';
  rawPayload: Record<string, unknown>;
  incident: Incident;
  mitreHints: string[];
  geoHint?: string;
  assetId?: string;
  enrichmentLatencyMs: number;
}

export interface EvidenceRecord {
  agentRole: AgentRole;
  confidence: number;
  likelihoodRatio: number;
  reliabilityWeight: number;
  uncertainty: number;
  evidence: EvidenceItem[];
  toolsUsed: string[];
  executionTimeMs: number;
  timestamp: string;
}

export interface InvestigationPlan {
  investigationId: string;
  incidentId: string;
  agentSequence: AgentRole[];
  parallelGroups: AgentRole[][];
  terminationConditions: string[];
  fallbackStrategy: string;
  maxDurationMs: number;
  requiresHumanApproval: boolean;
  createdAt: string;
}

export interface InvestigationState {
  investigationId: string;
  incidentId: string;
  plan: InvestigationPlan;
  status: 'PLANNING' | 'RUNNING' | 'PAUSED_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  completedAgents: AgentRole[];
  agentStatuses: Partial<Record<AgentRole, 'COMPLETED' | 'FAILED'>>;
  evidenceRecords: EvidenceRecord[];
  decision?: DecisionIntelligence;
  startedAt: string;
  updatedAt: string;
  pausedAt?: string;
  completedAt?: string;
  error?: string;
  stageDurationsMs?: Partial<Record<'triage' | 'plan' | 'fanout' | 'fuse' | 'forecast' | 'decide', number>>;
}

export interface IOCLookupResult {
  value: string;
  type: IOCType;
  fromCache: boolean;
  provider: string;
  ioc: IOCItem;
  lookupLatencyMs: number;
}

export interface BenchmarkResult {
  scenarioId: string;
  scenarioName: string;
  startedAt: string;
  completedAt: string;
  totalAlerts: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgLatencyMs: number;
  avgContainmentTimeMs: number;
  mitreCoveragePercent: number;
  agentPerformance: Record<AgentRole, { avgLatencyMs: number; successRate: number }>;
  totalCostUnits: number;
  tierLatencyMs?: Record<string, number>;
  mitreDistribution?: Record<string, number>;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
}

export interface RiskForecast {
  timestamp: string;
  nodeId: string;
  nodeLabel: string;
  currentRisk: number;
  forecastedRisk: number;
  propagationVelocity: number;
  estimatedCompromiseAt?: string;
  interventionRecommendation: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  traceId?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchResult {
  type: 'incident' | 'agent' | 'ioc' | 'report' | 'audit' | 'mitre';
  id: string;
  title: string;
  subtitle?: string;
  severity?: Severity;
  score: number;
}
