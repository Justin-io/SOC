/**
 * AEGIS-X Enterprise SOC Operational Console - Data Types
 */

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

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  asset: {
    id: string;
    hostname: string;
    ip: string;
    type: string;
    criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    owner: string;
  };
  source: string;
  mitreTechnique: {
    id: string;
    name: string;
    tactic: string;
  };
  confidence: number; // 0 - 100
  riskScore: number; // 0 - 100
  dissentScore: number; // 0 - 100
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
  reliabilityWeight: number; // 0 - 1.0
  totalRequests: number;
  toolCalls: number;
  errorCount: number;
  cacheHitRate: number; // percentage
  executionTimeMs: number;
  uptimePercent: number;
  lastExecution: string;
  description: string;
}

export interface EvidenceItem {
  id: string;
  incidentId: string;
  timestamp: string;
  type: 'LOG' | 'NETWORK' | 'FILE' | 'MEMORY' | 'AUTH' | 'API';
  source: string;
  rawContent: string;
  weight: number; // 1 - 10
  confidence: number; // 0 - 100
  mitreId: string;
  toolUsed: string;
  hash?: string;
  flaggedByAgent: AgentRole;
}

export interface DecisionIntelligence {
  incidentId: string;
  finalProbability: number; // 0 - 100%
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

export interface IOCItem {
  value: string;
  type: 'IP' | 'HASH' | 'DOMAIN' | 'URL' | 'EMAIL';
  reputation: 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN' | 'UNKNOWN';
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

export interface NetworkNode {
  id: string;
  label: string;
  type: 'WORKSTATION' | 'SERVER' | 'DATABASE' | 'GATEWAY' | 'CLOUD_INSTANCE' | 'CONTAINER';
  ip: string;
  os: string;
  riskLevel: 'CLEAN' | 'WARNING' | 'DANGER' | 'CRITICAL';
  status: 'ONLINE' | 'ISOLATED' | 'COMPROMISED' | 'EMULATED_ISOLATION';
  vulnerabilitiesCount: number;
  businessValue: 'HIGH' | 'MEDIUM' | 'LOW';
  zone: string;
  connections: string[];
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
  estimatedBusinessCost: number; // USD
  estimatedContainmentCost: number; // USD
  confidence: number;
  containmentEffectiveness: number; // %
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

export interface SOCReport {
  id: string;
  title: string;
  category: 'EXECUTIVE' | 'COMPLIANCE' | 'INCIDENT_POST_MORTEM' | 'THREAT_BRIEF' | 'INCIDENT' | 'THREAT_INTEL' | string;
  generatedAt: string;
  date?: string;
  author: string;
  generatedBy?: string;
  status: 'READY' | 'GENERATING' | 'FAILED';
  summary: string;
  incidentCount?: number;
  fileSizeMb?: number;
  mitreCoveragePercent?: number;
  keyFindings?: string[];
  recommendations?: string[];
  downloadUrl?: string;
}

export interface SOCSettings {
  riskThreshold: number; // e.g. 75%
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

export type SystemSettings = SOCSettings;

export interface SystemHealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  apiStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  agentAvailability: number; // percentage
  llmQueueDepth: number;
  realtimeConnected: boolean;
  toolHealth: {
    siem: 'OPERATIONAL' | 'DEGRADED';
    edr: 'OPERATIONAL' | 'DEGRADED';
    firewall: 'OPERATIONAL' | 'DEGRADED';
    cloudLogs: 'OPERATIONAL' | 'DEGRADED';
  };
}
