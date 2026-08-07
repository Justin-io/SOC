/**
 * AEGIS-X Backend — Operational State Store
 * In-memory operational state for incidents, IOCs, reports, network nodes, settings.
 * Seeded from frontend synthetic data schema. All API routes read/write this store.
 */

import type {
  Incident, IOCItem, SOCReport, NetworkNode, DigitalTwinState,
  DecisionIntelligence, EvidenceItem, SOCSettings, AuditBlock,
} from '../core/types.js';

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED_INCIDENTS: Incident[] = [
  {
    id: 'INC-2026-9041',
    title: 'Kerberoasting & LSASS Memory Extraction on Domain Controller',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    asset: { id: 'AST-001', hostname: 'DC01-PROD-EAST', ip: '10.142.4.10', type: 'Domain Controller', criticality: 'CRITICAL', owner: 'Identity & Access Team' },
    source: 'CrowdStrike EDR + Active Directory Audit',
    mitreTechnique: { id: 'T1003.001', name: 'OS Credential Dumping: LSASS Memory', tactic: 'Credential Access' },
    confidence: 96, riskScore: 94, dissentScore: 8,
    timestamp: '2026-08-07T05:42:10Z',
    description: 'Suspicious memory dump process executed against lsass.exe followed by Kerberos ticket request TGS-REQ with RC4 encryption.',
    assignedAgent: 'COORDINATOR', affectedSystemsCount: 14,
    containmentImpact: 'Isolating DC01-PROD-EAST will trigger secondary DC rollover. Zero downtime if backup DC02 is active.',
    businessImpact: 'High risk of enterprise-wide Active Directory administrative domain compromise.',
    recommendedAction: 'Isolate host DC01-PROD-EAST immediately, purge compromised SPN tickets, force krbtgt password reset.',
    counterfactualExplanation: 'Without LSASS memory dump evidence, threat level drops to MEDIUM. However, memory dump + TGS-REQ RC4 confirms active credential theft.',
    likelihoodRatio: 18.4,
  },
  {
    id: 'INC-2026-9042',
    title: 'Unauthorized IAM Role Assumption & S3 Bucket Exfiltration',
    severity: 'CRITICAL',
    status: 'CONTAINMENT_PENDING',
    asset: { id: 'AST-089', hostname: 'aws-prod-data-lake-s3', ip: '172.31.12.88', type: 'AWS S3 Bucket', criticality: 'CRITICAL', owner: 'Data Engineering' },
    source: 'AWS CloudTrail + GuardDuty',
    mitreTechnique: { id: 'T1530', name: 'Data from Cloud Storage Object', tactic: 'Exfiltration' },
    confidence: 92, riskScore: 91, dissentScore: 12,
    timestamp: '2026-08-07T05:38:00Z',
    description: 'STS AssumeRole invoked from suspicious TOR exit node 185.220.101.45, retrieving 4.2GB customer PII data.',
    assignedAgent: 'CLOUD', affectedSystemsCount: 3,
    containmentImpact: 'Revoke AWS IAM Session Policy instantly. Minimal operational impact to microservices.',
    businessImpact: 'Potential regulatory compliance breach (GDPR / CCPA) if PII data exfiltration is verified.',
    recommendedAction: 'Attach explicit Deny * inline IAM policy to compromised role SecurityOpsAdminRole.',
    counterfactualExplanation: 'If IP 185.220.101.45 belonged to developer VPN, risk would be LOW. CloudTrail geolocated IP to unapproved autonomous system.',
    likelihoodRatio: 14.2,
  },
  {
    id: 'INC-2026-9043',
    title: 'Kubernetes Pod Escalate Privilege & C2 Gateway Beaconing',
    severity: 'HIGH',
    status: 'TRIAGED',
    asset: { id: 'AST-104', hostname: 'k8s-worker-node-04', ip: '10.240.1.54', type: 'Kubernetes Worker Node', criticality: 'HIGH', owner: 'Platform Engineering' },
    source: 'Falco Container Runtime Logs',
    mitreTechnique: { id: 'T1611', name: 'Escape to Host', tactic: 'Privilege Escalation' },
    confidence: 88, riskScore: 82, dissentScore: 15,
    timestamp: '2026-08-07T04:51:00Z',
    description: 'Privileged container escape detected. Pod attempting to mount host filesystem and initiate outbound C2 beacon on port 8443.',
    assignedAgent: 'CLOUD', affectedSystemsCount: 7,
    containmentImpact: 'Cordoning worker node will reschedule 12 pods to remaining 4 nodes. Potential 15% capacity reduction.',
    businessImpact: 'Risk of lateral movement to adjacent production namespaces containing financial processing workloads.',
    recommendedAction: 'Cordon k8s-worker-node-04 immediately. Revoke cluster-admin service account. Apply egress NetworkPolicy.',
    counterfactualExplanation: 'Without the privileged container flag in pod spec, escape to host would be significantly more difficult.',
    likelihoodRatio: 9.8,
  },
  {
    id: 'INC-2026-9044',
    title: 'Lateral Movement via Pass-the-Hash on Finance Workstation',
    severity: 'HIGH',
    status: 'NEW',
    asset: { id: 'AST-033', hostname: 'WRK-FINANCE-09', ip: '10.10.44.9', type: 'Workstation', criticality: 'HIGH', owner: 'Finance Operations' },
    source: 'Splunk SIEM + Windows Event Log',
    mitreTechnique: { id: 'T1550.002', name: 'Pass the Hash', tactic: 'Lateral Movement' },
    confidence: 84, riskScore: 79, dissentScore: 18,
    timestamp: '2026-08-07T05:55:00Z',
    description: 'NTLM hash authentication detected from WRK-FINANCE-09 attempting to authenticate to SQL-PROD-FINANCE without plaintext credentials.',
    assignedAgent: 'MALWARE', affectedSystemsCount: 4,
    containmentImpact: 'Isolating workstation will affect 2 finance users. Temporary credential re-issuance required.',
    businessImpact: 'Risk of unauthorized access to financial reporting SQL server containing quarterly earnings data.',
    recommendedAction: 'Isolate WRK-FINANCE-09, force NTLM authentication disable via GPO, rotate impacted NTLM hashes.',
    counterfactualExplanation: 'If SMB signing was enforced network-wide, Pass-the-Hash would fail silently. Current policy gap enables this vector.',
    likelihoodRatio: 7.3,
  },
  {
    id: 'INC-2026-9045',
    title: 'Suspicious PowerShell Execution & Defender Bypass Attempt',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    asset: { id: 'AST-055', hostname: 'WRK-SEC-04', ip: '10.10.22.55', type: 'Workstation', criticality: 'MEDIUM', owner: 'Security Operations' },
    source: 'Microsoft Defender for Endpoint',
    mitreTechnique: { id: 'T1059.001', name: 'PowerShell Execution', tactic: 'Execution' },
    confidence: 76, riskScore: 62, dissentScore: 22,
    timestamp: '2026-08-07T03:22:00Z',
    description: 'PowerShell invoked with -ExecutionPolicy Bypass flag. AMSI bypass attempt via reflection detected and blocked by Defender.',
    assignedAgent: 'MALWARE', affectedSystemsCount: 1,
    containmentImpact: 'Endpoint isolated for 45 minutes. Fully restored after memory forensics confirmed no persistence.',
    businessImpact: 'Minimal — single endpoint affected. No lateral movement detected.',
    recommendedAction: 'Review and tighten PowerShell Constrained Language Mode. Audit AppLocker policy on security workstations.',
    counterfactualExplanation: 'Without AMSI bypass attempt pattern, this would classify as authorized admin activity.',
    likelihoodRatio: 4.1,
  },
];

const SEED_IOCS: IOCItem[] = [
  {
    value: '185.220.101.45',
    type: 'IP',
    reputation: 'MALICIOUS',
    confidence: 97,
    threatFamily: 'Tor Exit Node / APT29',
    firstSeen: '2026-01-15T00:00:00Z',
    lastSeen: new Date().toISOString(),
    mitreMapping: ['T1090.003', 'T1078.004', 'T1530'],
    virusTotal: { malicious: 52, suspicious: 8, harmless: 12, scoreRatio: '52/72' },
    abuseIPDB: { abuseConfidenceScore: 94, totalReports: 412, countryCode: 'NL' },
    shodan: { ports: [80, 443, 1080, 9050], vulnerabilitiesCount: 0, isp: 'Tor Exit Node ISP' },
    relatedIncidentsCount: 3,
    historicalObservations: 847,
  },
  {
    value: 'e99a18c428cb38d5f260853678922e03',
    type: 'HASH',
    reputation: 'MALICIOUS',
    confidence: 99,
    threatFamily: 'Mimikatz v2.2.0',
    firstSeen: '2025-08-01T00:00:00Z',
    lastSeen: new Date().toISOString(),
    mitreMapping: ['T1003.001', 'T1558.003'],
    virusTotal: { malicious: 68, suspicious: 4, harmless: 0, scoreRatio: '68/72' },
    abuseIPDB: { abuseConfidenceScore: 0, totalReports: 0, countryCode: 'N/A' },
    shodan: { ports: [], vulnerabilitiesCount: 0, isp: 'N/A' },
    relatedIncidentsCount: 1,
    historicalObservations: 2341,
  },
  {
    value: 'cobaltstrike-c2.xyz',
    type: 'DOMAIN',
    reputation: 'MALICIOUS',
    confidence: 95,
    threatFamily: 'Cobalt Strike C2 Infrastructure',
    firstSeen: '2026-03-10T00:00:00Z',
    lastSeen: new Date().toISOString(),
    mitreMapping: ['T1071.001', 'T1090', 'T1219'],
    virusTotal: { malicious: 44, suspicious: 11, harmless: 2, scoreRatio: '44/57' },
    abuseIPDB: { abuseConfidenceScore: 88, totalReports: 156, countryCode: 'RU' },
    shodan: { ports: [80, 443, 8443, 50050], vulnerabilitiesCount: 2, isp: 'Hetzner Online GmbH' },
    relatedIncidentsCount: 2,
    historicalObservations: 523,
  },
  {
    value: 'powershell-amsi-bypass.ps1',
    type: 'HASH',
    reputation: 'SUSPICIOUS',
    confidence: 78,
    threatFamily: 'AMSI Bypass Script',
    firstSeen: '2026-06-01T00:00:00Z',
    lastSeen: new Date().toISOString(),
    mitreMapping: ['T1059.001', 'T1562.001'],
    virusTotal: { malicious: 28, suspicious: 19, harmless: 25, scoreRatio: '28/72' },
    abuseIPDB: { abuseConfidenceScore: 0, totalReports: 0, countryCode: 'N/A' },
    shodan: { ports: [], vulnerabilitiesCount: 0, isp: 'N/A' },
    relatedIncidentsCount: 1,
    historicalObservations: 89,
  },
  {
    value: 'svc-backup-admin@internal.corp',
    type: 'EMAIL',
    reputation: 'SUSPICIOUS',
    confidence: 72,
    threatFamily: 'Credential Phishing Target',
    firstSeen: '2026-07-20T00:00:00Z',
    lastSeen: new Date().toISOString(),
    mitreMapping: ['T1078', 'T1566'],
    virusTotal: { malicious: 5, suspicious: 12, harmless: 55, scoreRatio: '5/72' },
    abuseIPDB: { abuseConfidenceScore: 0, totalReports: 0, countryCode: 'N/A' },
    shodan: { ports: [], vulnerabilitiesCount: 0, isp: 'N/A' },
    relatedIncidentsCount: 2,
    historicalObservations: 14,
  },
];

const SEED_NETWORK_NODES: NetworkNode[] = [
  { id: 'node-dc01', label: 'DC01-PROD-EAST', type: 'SERVER', ip: '10.142.4.10', os: 'Windows Server 2022', riskLevel: 'CRITICAL', status: 'COMPROMISED', vulnerabilitiesCount: 3, businessValue: 'HIGH', propagationStep: 0 },
  { id: 'node-dc02', label: 'DC02-PROD-WEST', type: 'SERVER', ip: '10.142.4.11', os: 'Windows Server 2022', riskLevel: 'WARNING', status: 'ONLINE', vulnerabilitiesCount: 1, businessValue: 'HIGH', propagationStep: 1 },
  { id: 'node-gateway', label: 'CORP-GATEWAY-01', type: 'GATEWAY', ip: '10.0.0.1', os: 'Palo Alto PAN-OS', riskLevel: 'WARNING', status: 'ONLINE', vulnerabilitiesCount: 0, businessValue: 'HIGH', propagationStep: 1 },
  { id: 'node-sql', label: 'SQL-PROD-FINANCE', type: 'DATABASE', ip: '10.50.1.20', os: 'SQL Server 2022', riskLevel: 'DANGER', status: 'ONLINE', vulnerabilitiesCount: 2, businessValue: 'HIGH', propagationStep: 2 },
  { id: 'node-wrk-finance', label: 'WRK-FINANCE-09', type: 'WORKSTATION', ip: '10.10.44.9', os: 'Windows 11', riskLevel: 'DANGER', status: 'ONLINE', vulnerabilitiesCount: 1, businessValue: 'MEDIUM', propagationStep: 2 },
  { id: 'node-k8s', label: 'K8S-WORKER-04', type: 'CONTAINER', ip: '10.240.1.54', os: 'Ubuntu 22.04 LTS', riskLevel: 'WARNING', status: 'ONLINE', vulnerabilitiesCount: 1, businessValue: 'HIGH', propagationStep: 1 },
  { id: 'node-aws-s3', label: 'AWS-S3-DATA-LAKE', type: 'CLOUD_INSTANCE', ip: '172.31.12.88', os: 'AWS Managed', riskLevel: 'CRITICAL', status: 'ONLINE', vulnerabilitiesCount: 2, businessValue: 'HIGH', propagationStep: 0 },
  { id: 'node-wrk-sec', label: 'WRK-SEC-04', type: 'WORKSTATION', ip: '10.10.22.55', os: 'Windows 11', riskLevel: 'CLEAN', status: 'ONLINE', vulnerabilitiesCount: 0, businessValue: 'MEDIUM' },
];

const SEED_EVIDENCE: EvidenceItem[] = [
  {
    id: 'EVD-001',
    incidentId: 'INC-2026-9041',
    timestamp: '2026-08-07T05:40:00Z',
    type: 'MEMORY',
    source: 'CrowdStrike Falcon EDR',
    rawContent: 'Process mimikatz.exe (PID 8732) opened handle to lsass.exe (PID 684) with PROCESS_VM_READ access. Memory dump confirmed.',
    weight: 10,
    confidence: 99,
    mitreId: 'T1003.001',
    toolUsed: 'CrowdStrike Falcon',
    hash: 'e99a18c428cb38d5f260853678922e03',
    flaggedByAgent: 'MALWARE',
  },
  {
    id: 'EVD-002',
    incidentId: 'INC-2026-9041',
    timestamp: '2026-08-07T05:41:00Z',
    type: 'AUTH',
    source: 'Active Directory KDC Logs',
    rawContent: 'TGS-REQ observed from DC01-PROD-EAST for SPN svc-backup-admin/corp with RC4-HMAC encryption type. Kerberoasting signature confirmed.',
    weight: 9,
    confidence: 97,
    mitreId: 'T1558.003',
    toolUsed: 'Active Directory Audit',
    flaggedByAgent: 'THREAT_INTEL',
  },
  {
    id: 'EVD-003',
    incidentId: 'INC-2026-9041',
    timestamp: '2026-08-07T05:41:30Z',
    type: 'NETWORK',
    source: 'Palo Alto NGFW Flow Logs',
    rawContent: 'Outbound connection from DC01-PROD-EAST (10.142.4.10) to 185.220.101.45:443 (Tor exit node) - 4.2 GB egress detected. Session duration: 8 minutes.',
    weight: 10,
    confidence: 96,
    mitreId: 'T1041',
    toolUsed: 'Palo Alto NGFW',
    flaggedByAgent: 'CLOUD',
  },
  {
    id: 'EVD-004',
    incidentId: 'INC-2026-9041',
    timestamp: '2026-08-07T05:42:00Z',
    type: 'LOG',
    source: 'Splunk/Chronicle SIEM Correlation',
    rawContent: 'SIEM correlation rule CREDENTIAL_DUMP_PLUS_EXFIL_COMBO triggered. 3 parent rules matched simultaneously: LSASS_ACCESS + KERBEROASTING + OUTBOUND_TOR. Confidence: CRITICAL.',
    weight: 8,
    confidence: 94,
    mitreId: 'T1003.001',
    toolUsed: 'Splunk Enterprise Security',
    flaggedByAgent: 'COORDINATOR',
  },
];

const SEED_DECISION: DecisionIntelligence = {
  incidentId: 'INC-2026-9041',
  finalProbability: 96,
  dissentLevel: 'LOW',
  dissentAgents: ['EDGE'],
  riskScore: 94,
  confidenceScore: 91,
  recommendedAction: 'Isolate host DC01-PROD-EAST immediately. Purge compromised SPN tickets for svc-backup-admin. Force krbtgt double-reset (T+0h and T+10h). Enable LAPS across Identity OU.',
  counterfactualExplanation: 'Without LSASS memory dump (EVD-001), threat classification drops to HIGH. Without Kerberos TGS-REQ RC4 evidence (EVD-002), confidence drops to 78%. Both together are definitive.',
  businessImpact: 'High risk of enterprise-wide Active Directory compromise. 14 systems at risk of lateral movement. Finance, HR and executive workstations in blast radius.',
  containmentImpact: 'Isolating DC01-PROD-EAST triggers automatic DC02-PROD-WEST failover. Expected zero downtime. Estimated containment time: 3.4 minutes.',
  approvalStatus: 'PENDING',
};

const SEED_SETTINGS: SOCSettings = {
  riskThreshold: 75,
  autoContainmentRiskThreshold: 90,
  dissentSensitivityThreshold: 30,
  humanSlaTimeoutMinutes: 5,
  conformalCoverageAlpha: 0.05,
  dissentSensitivity: 'BALANCED',
  autoContainmentEnabled: false,
  modelRouting: {
    COORDINATOR: 'gemini-2.0-flash',
    THREAT_INTEL: 'gemini-2.0-flash',
    MALWARE: 'gemini-2.0-flash',
    CLOUD: 'gemini-2.0-flash',
    INCIDENT_RESPONSE: 'gemini-2.0-flash',
    COMPLIANCE: 'gemini-2.0-flash',
    EDGE: 'gemini-2.0-flash',
    DECEPTION: 'gemini-2.0-flash',
    HUMAN: 'human-in-the-loop',
    FUSION_ENGINE: 'deterministic-bayesian',
  },
  agentEnabled: {
    COORDINATOR: true, THREAT_INTEL: true, MALWARE: true, CLOUD: true,
    INCIDENT_RESPONSE: true, COMPLIANCE: true, EDGE: true, DECEPTION: true,
    HUMAN: true, FUSION_ENGINE: true,
  },
  rateLimitPerMin: 120,
  memoryLimitMb: 2048,
  apiKeySet: Boolean(process.env.GEMINI_API_KEY),
  realtimeRefreshIntervalMs: 4000,
  supabaseStatus: 'DISCONNECTED',
  featureFlags: {
    experimentalChrononWave: true,
    conformalPrediction: true,
    autoEvidenceFusion: true,
    deceptionHoneyMesh: true,
  },
};

const HAS_API_KEY = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && process.env.GEMINI_API_KEY.length > 5);

// ─── Mutable State ────────────────────────────────────────────────────────────

class OperationalStore {
  public incidents: Incident[] = HAS_API_KEY ? [] : [...SEED_INCIDENTS];
  public iocs: IOCItem[] = HAS_API_KEY ? [] : [...SEED_IOCS];
  public reports: SOCReport[] = [];
  public networkNodes: NetworkNode[] = [...SEED_NETWORK_NODES];
  public evidence: EvidenceItem[] = HAS_API_KEY ? [] : [...SEED_EVIDENCE];
  public decision: DecisionIntelligence = HAS_API_KEY
    ? {
        incidentId: '',
        finalProbability: 0,
        dissentLevel: 'NONE',
        dissentAgents: [],
        riskScore: 0,
        confidenceScore: 0,
        recommendedAction: 'Awaiting telemetry ingestion.',
        counterfactualExplanation: 'No active incident.',
        businessImpact: 'Nominal operational status.',
        containmentImpact: 'No containment active.',
        approvalStatus: 'PENDING',
      }
    : { ...SEED_DECISION };
  public settings: SOCSettings = { ...SEED_SETTINGS };

  public clearAll(): void {
    this.incidents = [];
    this.iocs = [];
    this.evidence = [];
    this.reports = [];
  }

  // Helpers
  getIncident(id: string): Incident | null {
    return this.incidents.find((i) => i.id === id) ?? null;
  }

  updateIncidentStatus(id: string, status: Incident['status']): Incident | null {
    const inc = this.incidents.find((i) => i.id === id);
    if (!inc) return null;
    inc.status = status;
    return inc;
  }

  addReport(report: SOCReport): void {
    this.reports.unshift(report);
  }

  updateSettings(settings: SOCSettings): void {
    this.settings = settings;
  }

  toggleNodeIsolation(nodeId: string): NetworkNode | null {
    const node = this.networkNodes.find((n) => n.id === nodeId);
    if (!node) return null;
    node.status = node.status === 'EMULATED_ISOLATION' ? 'ONLINE' : 'EMULATED_ISOLATION';
    return node;
  }
}

export const store = new OperationalStore();
