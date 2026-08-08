
const _T = Date.now();
/** Returns ISO timestamp for N minutes ago relative to backend startup time */
const t = (minutesAgo: number) => new Date(_T - minutesAgo * 60_000).toISOString();

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
    id: 'INC-2026-9046',
    title: 'Deception Honey-Token Triggered — SQL Vault Credential Accessed by WRK-OFFSHORE-14',
    severity: 'HIGH',
    status: 'TRIAGED',
    asset: { id: 'AST-HONEY-01', hostname: 'HONEY-VAULT-DB', ip: '10.99.99.15', type: 'Deception Asset', criticality: 'LOW', owner: 'Security Operations — Deception Mesh' },
    source: 'AEGIS-X Deception Engine / Canary Token Grid',
    mitreTechnique: { id: 'T1083', name: 'File and Directory Discovery', tactic: 'Discovery' },
    confidence: 99, riskScore: 89, dissentScore: 2,
    timestamp: t(2),
    description: 'Canary SQL credential "aegis_readonly_svc / Vault#Prod2026!" stored in HONEY-VAULT-DB was read by host 10.10.8.44 (WRK-OFFSHORE-14) via ODBC connection string extraction from explorer.exe PID 3312. Honey-token has zero legitimate access baseline — any access is a confirmed IOC. Same IP initiated SMB admin$ enumeration 90 seconds later.',
    assignedAgent: 'DECEPTION', affectedSystemsCount: 1,
    containmentImpact: 'Quarantining 10.10.8.44 causes zero business disruption — deception asset, no production data.',
    businessImpact: 'Zero direct data loss. High-fidelity indicator of active lateral movement across corp-lan.',
    recommendedAction: 'Quarantine WRK-OFFSHORE-14 (10.10.8.44) immediately. Revoke NTLM hash for svc_deception_sql.',
    counterfactualExplanation: 'Deception assets carry zero legitimate traffic. Any access = IOC. False positive probability: 0.04%.',
    likelihoodRatio: 42.0,
    predictedNextTarget: 'DC01-PROD-EAST via SMB lateral move (91% probability)',
  },
  {
    id: 'INC-2026-9041',
    title: 'LSASS Memory Dump + Kerberoasting Burst (14 SPNs) on DC01-PROD-EAST',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    asset: { id: 'AST-001', hostname: 'DC01-PROD-EAST', ip: '10.142.4.10', type: 'Domain Controller', criticality: 'CRITICAL', owner: 'Identity & Access Team' },
    source: 'CrowdStrike Falcon EDR v7.12 + Windows Active Directory Security Audit',
    mitreTechnique: { id: 'T1003.001', name: 'OS Credential Dumping: LSASS Memory', tactic: 'Credential Access' },
    confidence: 96, riskScore: 94, dissentScore: 8,
    timestamp: t(22),
    description: 'powershell.exe (PID 4108) opened lsass.exe (PID 684) with access mask 0x1F3FFF (PROCESS_ALL_ACCESS). MiniDumpWriteDump() confirmed. Dump: C:\\Windows\\Temp\\debug_7f3a.dmp (148 MB). Followed by 14 RC4-HMAC TGS-REQ in 90s (Kerberoasting). Source: WRK-FINANCE-09 (10.10.44.9) — confirmed phishing victim.',
    assignedAgent: 'COORDINATOR', affectedSystemsCount: 14,
    containmentImpact: 'DC01 → DC02 failover. AD replication lag <3s. Zero Kerberos auth disruption for modern clients.',
    businessImpact: 'krbtgt hash extraction = Golden Ticket risk. 8,400 users and 2,100 endpoints in blast radius.',
    recommendedAction: 'Isolate DC01-PROD-EAST. Reset krbtgt twice (T+0 and T+24h). Invalidate all Kerberos tickets. Rotate 14 SPN account passwords.',
    counterfactualExplanation: 'If CrowdStrike prevention policy were PREVENT (not Audit-Only), LSASS dump fails at source and attack chain terminates entirely.',
    likelihoodRatio: 18.4,
    predictedNextTarget: 'k8s-cluster-api via service account token theft (88% Risk)',
  },
  {
    id: 'INC-2026-9042',
    title: 'AWS STS AssumeRole from TOR + S3 PII Exfiltration 4.2 GB (INC-2026-9042)',
    severity: 'CRITICAL',
    status: 'CONTAINMENT_PENDING',
    asset: { id: 'AST-089', hostname: 'aws-prod-data-lake-s3', ip: '172.31.12.88', type: 'AWS S3 Bucket', criticality: 'CRITICAL', owner: 'Data Engineering' },
    source: 'AWS CloudTrail + Amazon GuardDuty + Macie PII Scanner',
    mitreTechnique: { id: 'T1530', name: 'Data from Cloud Storage Object', tactic: 'Collection' },
    confidence: 92, riskScore: 91, dissentScore: 12,
    timestamp: t(8),
    description: 'AssumeRole for arn:aws:iam::381492057841:role/SecurityOpsAdminRole from 185.220.101.45 (TOR, AS201814 Mullvad) at ' + t(14) + '. GuardDuty: UnauthorizedAccess:IAMUser/TorIPCaller (8.9/10). S3 egress: 4,219,715,660 bytes (4.2 GB) — customers/2026/*/profile_*.parquet. Macie confirmed SSN, DOB, credit card PANs, email addresses.',
    assignedAgent: 'CLOUD', affectedSystemsCount: 3,
    containmentImpact: 'Emergency Deny * inline policy on SecurityOpsAdminRole. Revoke STS token AQoXnyc3FIAA. Zero microservice impact.',
    businessImpact: 'GDPR Article 33 breach notification required within 72 hours. CCPA notification to 4,218+ residents. Estimated regulatory exposure: $2.8M–$14M.',
    recommendedAction: 'aws iam put-role-policy EmergencyDeny. Revoke STS session. Enable S3 MFA-delete. Engage DPO for GDPR Article 33 timeline.',
    counterfactualExplanation: 'If source IP were in approved developer VPN CIDR 10.100.0.0/16, this would be routine admin activity. TOR classification eliminates benign hypothesis.',
    likelihoodRatio: 14.2,
    predictedNextTarget: 'aws-iam-master-role via iam:PassRole escalation (91% Risk)',
  },
  {
    id: 'INC-2026-9043',
    title: 'Container Escape to Host + Cobalt Strike Beacon on k8s-worker-node-04',
    severity: 'HIGH',
    status: 'TRIAGED',
    asset: { id: 'AST-104', hostname: 'k8s-worker-node-04', ip: '10.240.1.54', type: 'Kubernetes Worker Node', criticality: 'HIGH', owner: 'Platform Engineering' },
    source: 'Falco Runtime Security + Cilium Network Policy Engine',
    mitreTechnique: { id: 'T1611', name: 'Escape to Host', tactic: 'Privilege Escalation' },
    confidence: 88, riskScore: 82, dissentScore: 15,
    timestamp: t(4),
    description: 'Falco: container_escape_via_nsenter fired. Pod payment-gateway-v2 (ns: payments) executed nsenter --target 1 --mount --uts --ipc --net --pid -- bash. securityContext.privileged: true enabled in PLAT-4821. Post-escape: read /proc/1/environ, mounted /var/lib/kubelet/pods. Beacon to 91.108.4.44:8443 (Cobalt Strike C2, AS62041 Serverius). Check-in: 60s.',
    assignedAgent: 'MALWARE', affectedSystemsCount: 8,
    containmentImpact: 'kubectl cordon + drain: 12 pods rescheduled to nodes 01-03. 15% capacity reduction, ETA 8 min to restore.',
    businessImpact: 'Attacker has read access to secrets from all co-located pods. pmt-svc-account token exposes kube-apiserver.',
    recommendedAction: 'kubectl cordon k8s-worker-node-04. Delete pmt-svc-account. Block 91.108.4.44 at Cilium NetworkPolicy. Patch securityContext.privileged: false.',
    counterfactualExplanation: 'Without privileged: true in securityContext (PLAT-4821 misconfiguration), nsenter requires explicit CAP_SYS_ADMIN — this escape vector is eliminated entirely.',
    likelihoodRatio: 9.8,
    predictedNextTarget: 'kube-apiserver via service account credential theft (85% Risk)',
  },
  {
    id: 'INC-2026-9044',
    title: 'Pass-the-Hash Lateral Move WRK-FINANCE-09 → FILESERVER-CORP (Mimikatz Confirmed)',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    asset: { id: 'AST-033', hostname: 'WRK-FINANCE-09', ip: '10.10.44.9', type: 'Workstation', criticality: 'HIGH', owner: 'Finance Operations' },
    source: 'Splunk SIEM + Microsoft Defender for Endpoint + Windows Security Event Log',
    mitreTechnique: { id: 'T1550.002', name: 'Use Alternate Authentication Material: Pass the Hash', tactic: 'Lateral Movement' },
    confidence: 84, riskScore: 79, dissentScore: 18,
    timestamp: t(38),
    description: 'Event 4624 (Logon Type 3, NTLM) on FILESERVER-CORP (10.10.4.20) from WRK-FINANCE-09 (10.10.44.9) using CORP\\finance_svc_share. Preceded by Event 4648 with mismatched source hostname — PtH via Mimikatz sekurlsa::pth. Mimikatz hash: 4a8b9c0d... (64/68 VT engines). Process tree: invoice_august.iso → setup.exe → mimikatz.exe → PtH. 842 files enumerated in 12 seconds.',
    assignedAgent: 'INCIDENT_RESPONSE', affectedSystemsCount: 4,
    containmentImpact: 'Isolate WRK-FINANCE-09 via CrowdStrike Network Containment. Zero shared services — no production impact.',
    businessImpact: 'finance_svc_share used for payroll batch scripts. Attacker access to \\\\FILESERVER-CORP\\Finance$ risks payroll fraud.',
    recommendedAction: 'CrowdStrike isolate WRK-FINANCE-09. Reset finance_svc_share NTLM hash. Enable Protected Users group for all service accounts.',
    counterfactualExplanation: 'NTLM Type 3 logon is common. Mimikatz binary VT match (64/68 engines) plus Event 4648 hostname mismatch is the definitive differentiator.',
    likelihoodRatio: 8.1,
    predictedNextTarget: 'DC01-PROD-EAST via PtH with domain admin hash (79% Risk)',
  },
  {
    id: 'INC-2026-9045',
    title: 'DNS Tunneling C2: 1,420 Base64 TXT Queries to c2-exfil-proxy.top over 58 Minutes',
    severity: 'MEDIUM',
    status: 'INVESTIGATING',
    asset: { id: 'AST-201', hostname: 'DNS-RESOLVER-INT-01', ip: '10.0.0.53', type: 'DNS Server', criticality: 'HIGH', owner: 'Network Infrastructure' },
    source: 'Palo Alto DNS Security + Zeek PCAP Analysis + Splunk UBA',
    mitreTechnique: { id: 'T1071.004', name: 'Application Layer Protocol: DNS', tactic: 'Command and Control' },
    confidence: 76, riskScore: 62, dissentScore: 22,
    timestamp: t(62),
    description: 'Palo Alto DNS Security flagged c2-exfil-proxy.top: 1,420 TXT queries over 58 min (24.5 req/min vs baseline 0.2). Query labels are Base64-encoded heartbeats. Responses contain Base64 command payloads (avg 248 bytes). Sources: 10.10.44.9 (WRK-FINANCE-09) and 10.240.1.54 (k8s-worker-node-04) — single attacker C2 infrastructure confirmed.',
    assignedAgent: 'EDGE', affectedSystemsCount: 2,
    containmentImpact: 'DNS sinkhole c2-exfil-proxy.top via RPZ entry on DNS-RESOLVER-INT-01. Zero business disruption.',
    businessImpact: 'C2 channel used for command dispatch. Disrupting may accelerate attacker timeline. Capture TXT payloads for command reconstruction.',
    recommendedAction: 'Add c2-exfil-proxy.top RPZ entry. Block AS204428 at perimeter FW. Decode all TXT response payloads from past 60 min.',
    counterfactualExplanation: 'High DNS rate alone is insufficient. Base64 label structure, .top TLD, AbuseIPDB score 82, and correlation with two compromised hosts confirms secondary C2.',
    likelihoodRatio: 4.5,
    predictedNextTarget: 'All corp-lan hosts via DNS-based command broadcast (64% Risk)',
  },
];

const SEED_IOCS: IOCItem[] = [
  {
    value: '185.220.101.45',
    type: 'IP',
    reputation: 'MALICIOUS',
    confidence: 98,
    threatFamily: 'TOR Exit Node — APT29 Cobalt Strike Infrastructure / AS201814 Mullvad VPN',
    firstSeen: '2026-03-14T00:00:00Z',
    lastSeen: t(8),
    mitreMapping: ['T1090.003', 'T1071.001', 'T1048.002'],
    virusTotal: { malicious: 78, suspicious: 12, harmless: 2, scoreRatio: '78/92' },
    abuseIPDB: { abuseConfidenceScore: 100, totalReports: 14200, countryCode: 'DE' },
    shodan: { ports: [80, 443, 9001, 9050], vulnerabilitiesCount: 14, isp: 'Mullvad VPN AB', os: 'Linux 5.15.x' },
    relatedIncidentsCount: 4,
    historicalObservations: 14200,
  },
  {
    value: '4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
    type: 'HASH',
    reputation: 'MALICIOUS',
    confidence: 97,
    threatFamily: 'Cobalt Strike Beacon 4.9.1 — DLL Reflective Loader (darkside_loader.dll)',
    firstSeen: '2026-07-28T12:00:00Z',
    lastSeen: t(45),
    mitreMapping: ['T1574.002', 'T1055.001', 'T1071.001'],
    virusTotal: { malicious: 64, suspicious: 4, harmless: 0, scoreRatio: '64/68' },
    abuseIPDB: { abuseConfidenceScore: 0, totalReports: 0, countryCode: 'US' },
    shodan: { ports: [], vulnerabilitiesCount: 0, isp: 'N/A' },
    relatedIncidentsCount: 2,
    historicalObservations: 88,
  },
  {
    value: 'c2-exfil-proxy.top',
    type: 'DOMAIN',
    reputation: 'MALICIOUS',
    confidence: 88,
    threatFamily: 'DNS Tunneling C2 — iodine/dnscat2 variant — APT campaign infrastructure',
    firstSeen: '2026-08-01T18:22:00Z',
    lastSeen: t(2),
    mitreMapping: ['T1071.004', 'T1048.001'],
    virusTotal: { malicious: 32, suspicious: 18, harmless: 10, scoreRatio: '32/60' },
    abuseIPDB: { abuseConfidenceScore: 82, totalReports: 45, countryCode: 'RU' },
    shodan: { ports: [53, 80, 443], vulnerabilitiesCount: 3, isp: 'Reg.ru Hosting', os: 'Linux' },
    relatedIncidentsCount: 1,
    historicalObservations: 1420,
  },
  {
    value: '91.108.4.44',
    type: 'IP',
    reputation: 'MALICIOUS',
    confidence: 91,
    threatFamily: 'Cobalt Strike Team Server — AS62041 Serverius Connectivity — Beacon C2 Port 8443',
    firstSeen: '2026-07-15T00:00:00Z',
    lastSeen: t(4),
    mitreMapping: ['T1090.002', 'T1071.001', 'T1219'],
    virusTotal: { malicious: 54, suspicious: 8, harmless: 4, scoreRatio: '54/66' },
    abuseIPDB: { abuseConfidenceScore: 96, totalReports: 2840, countryCode: 'NL' },
    shodan: { ports: [443, 8443, 50050], vulnerabilitiesCount: 6, isp: 'Serverius Connectivity B.V.', os: 'Linux 5.x' },
    relatedIncidentsCount: 3,
    historicalObservations: 2840,
  },
];

const SEED_NETWORK_NODES: NetworkNode[] = [
  { id: 'node-fw', label: 'Perimeter FW (PA-5220)', type: 'GATEWAY', ip: '203.0.113.1', os: 'PAN-OS 11.1.2', riskLevel: 'CLEAN', status: 'ONLINE', vulnerabilitiesCount: 0, businessValue: 'HIGH', zone: 'dmz', connections: ['node-dc01', 'node-k8s'], vulnerabilityScore: 2.1, propagationStep: 0 },
  { id: 'node-dc01', label: 'DC01-PROD-EAST (Domain Controller)', type: 'SERVER', ip: '10.142.4.10', os: 'Windows Server 2025 (Build 26100)', riskLevel: 'CRITICAL', status: 'COMPROMISED', vulnerabilitiesCount: 4, businessValue: 'HIGH', zone: 'corp-lan', connections: ['node-fw', 'node-dc02', 'node-db', 'node-wrk-finance'], vulnerabilityScore: 9.8, propagationStep: 1 },
  { id: 'node-dc02', label: 'DC02-PROD-EAST (Backup DC)', type: 'SERVER', ip: '10.142.4.11', os: 'Windows Server 2025 (Build 26100)', riskLevel: 'WARNING', status: 'ONLINE', vulnerabilitiesCount: 1, businessValue: 'HIGH', zone: 'corp-lan', connections: ['node-dc01', 'node-dns'], vulnerabilityScore: 5.8, propagationStep: 2 },
  { id: 'node-db', label: 'PostgreSQL DB Cluster (Primary)', type: 'DATABASE', ip: '10.142.8.50', os: 'Ubuntu 24.04 LTS + PostgreSQL 16.2', riskLevel: 'DANGER', status: 'ONLINE', vulnerabilitiesCount: 2, businessValue: 'HIGH', zone: 'db-tier', connections: ['node-dc01', 'node-wrk-finance'], vulnerabilityScore: 8.2, propagationStep: 2 },
  { id: 'node-wrk-finance', label: 'WRK-FINANCE-09 (Initial Foothold)', type: 'WORKSTATION', ip: '10.10.44.9', os: 'Windows 11 Enterprise 23H2', riskLevel: 'DANGER', status: 'ONLINE', vulnerabilitiesCount: 3, businessValue: 'MEDIUM', zone: 'corp-lan', connections: ['node-dc01', 'node-db', 'node-dns'], vulnerabilityScore: 8.4, propagationStep: 1 },
  { id: 'node-k8s', label: 'k8s-worker-node-04 (Payments)', type: 'CONTAINER', ip: '10.240.1.54', os: 'Ubuntu 24.04 LTS — containerd 1.7.12', riskLevel: 'WARNING', status: 'ONLINE', vulnerabilitiesCount: 5, businessValue: 'HIGH', zone: 'web-tier', connections: ['node-fw', 'node-aws-s3'], vulnerabilityScore: 7.1, propagationStep: 2 },
  { id: 'node-aws-s3', label: 'AWS S3 Data Lake (PII — COMPROMISED)', type: 'CLOUD_INSTANCE', ip: '172.31.12.88', os: 'AWS S3 Managed', riskLevel: 'CRITICAL', status: 'COMPROMISED', vulnerabilitiesCount: 1, businessValue: 'HIGH', zone: 'cloud-data', connections: ['node-k8s'], vulnerabilityScore: 9.1, propagationStep: 2 },
  { id: 'node-dns', label: 'DNS-RESOLVER-INT-01', type: 'SERVER', ip: '10.0.0.53', os: 'BIND 9.18 on Ubuntu 22.04', riskLevel: 'WARNING', status: 'ONLINE', vulnerabilitiesCount: 1, businessValue: 'LOW', zone: 'corp-lan', connections: ['node-dc02', 'node-wrk-finance'], vulnerabilityScore: 4.2, propagationStep: 3 },
];

const SEED_EVIDENCE: EvidenceItem[] = [
  {
    id: 'EVD-001',
    incidentId: 'INC-2026-9041',
    timestamp: t(38),
    type: 'MEMORY',
    source: 'CrowdStrike Falcon Sensor v7.12 — DC01-PROD-EAST',
    rawContent: '[ALERT] Process memory access detected.\nTarget: lsass.exe (PID 684, SYSTEM)\nAccessor: powershell.exe (PID 4108, CORP\\SYSTEM)\nAccess mask: 0x1F3FFF (PROCESS_ALL_ACCESS)\nAPI: MiniDumpWriteDump()\nOutput: C:\\Windows\\Temp\\debug_7f3a.dmp (148,234,240 bytes)\nDump SHA256: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2\nCS Prevention policy: AUDIT_ONLY (policy gap — should be PREVENT)',
    weight: 10,
    confidence: 98,
    mitreId: 'T1003.001',
    toolUsed: 'CrowdStrike Falcon EDR Sensor v7.12',
    hash: '8f3a1c9e8d2b0e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8',
    flaggedByAgent: 'MALWARE',
  },
  {
    id: 'EVD-002',
    incidentId: 'INC-2026-9041',
    timestamp: t(22),
    type: 'LOG',
    source: 'Windows Security Event Log — DC01-PROD-EAST',
    rawContent: 'Event ID: 4769 — A Kerberos service ticket was requested.\nAccount Name: WRK-FINANCE-09$\nService Name: MSSQLSvc/SQLSERVER01.corp.local:1433\nTicket Encryption Type: 0x17 (RC4-HMAC) — DOWNGRADE DETECTED\nClient Address: ::ffff:10.10.44.9\n[AEGIS] 14 TGS-REQ with RC4 in 90s window. Kerberoasting pattern confirmed.',
    weight: 9,
    confidence: 96,
    mitreId: 'T1558.003',
    toolUsed: 'Windows Security Event Subsystem — Splunk UF',
    hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
    flaggedByAgent: 'COORDINATOR',
  },
  {
    id: 'EVD-003',
    incidentId: 'INC-2026-9042',
    timestamp: t(14),
    type: 'LOG',
    source: 'AWS CloudTrail — us-east-1 (Account 381492057841)',
    rawContent: '{\n  "eventName": "AssumeRole",\n  "eventTime": "' + t(14) + '",\n  "sourceIPAddress": "185.220.101.45",\n  "userAgent": "aws-cli/2.13.4 Python/3.11.4",\n  "requestParameters": { "roleArn": "arn:aws:iam::381492057841:role/SecurityOpsAdminRole" },\n  "responseElements": { "credentials": { "accessKeyId": "ASIA3FJLK7MZQXR8N2PW", "sessionToken": "AQoXnyc3FIAA..." } }\n}\n[AEGIS] GuardDuty: UnauthorizedAccess:IAMUser/TorIPCaller (8.9/10)',
    weight: 10,
    confidence: 97,
    mitreId: 'T1078.004',
    toolUsed: 'AWS CloudTrail + GuardDuty',
    hash: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
    flaggedByAgent: 'CLOUD',
  },
  {
    id: 'EVD-004',
    incidentId: 'INC-2026-9044',
    timestamp: t(62),
    type: 'LOG',
    source: 'Microsoft Exchange Transport Log + Defender for Endpoint',
    rawContent: 'Attachment: invoice_august_2026.iso (87.4 MB)\nSHA256: 4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b\nVT Score: 64/68 MALICIOUS (Cobalt Strike Beacon 4.9.1)\nRecipient: f.martinez@corp.local → WRK-FINANCE-09\nSender: billing@invoices-corp-accounting.com (typosquatted, registered 4d ago)\nDelivery: Exchange On-Premises → WRK-FINANCE-09 Inbox\n[AEGIS] Initial access vector confirmed. ISO mount → DLL sideload chain.',
    weight: 9,
    confidence: 94,
    mitreId: 'T1566.001',
    toolUsed: 'Microsoft Exchange Transport + Defender for Endpoint',
    hash: '4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
    flaggedByAgent: 'THREAT_INTEL',
  },
];

const SEED_DECISION: DecisionIntelligence = {
  incidentId: 'INC-2026-9041',
  finalProbability: 96.4,
  dissentLevel: 'LOW',
  dissentAgents: ['EDGE'],
  riskScore: 94,
  confidenceScore: 96,
  recommendedAction:
    'AUTONOMOUS CONTAINMENT STAGED — AWAITING HUMAN APPROVAL:\n' +
    '① Network isolation of DC01-PROD-EAST via CrowdStrike Contain Host API\n' +
    '② krbtgt double-reset (T+0 and T+24h per MS AD recovery guidance)\n' +
    '③ Force Kerberos ticket invalidation across all 8,400 domain members\n' +
    '④ Quarantine WRK-FINANCE-09 via Defender for Endpoint isolation\n' +
    '⑤ AWS SecurityOpsAdminRole emergency Deny * policy attachment\n' +
    'Estimated execution time: 47 seconds post-approval.',
  counterfactualExplanation:
    'If CrowdStrike LSASS prevention policy were PREVENT (not Audit-Only), credential dump fails at source — entire attack chain terminates. ' +
    'If Okta MFA fatigue detection blocked the auto-accepted push, AWS STS AssumeRole fails — S3 exfil does not occur. ' +
    'Root cause: (1) CS policy gap on DC01, (2) missing Okta MFA anomaly detection for python-requests user-agent.',
  businessImpact:
    'DC01 failover to DC02: zero Kerberos disruption (<3s replication lag). ' +
    'WRK-FINANCE-09 isolation: zero production impact. ' +
    'AWS IAM Deny policy: zero service interruption. ' +
    'GDPR Article 33 notification window: 71h 52m remaining.',
  containmentImpact:
    'Risk drops from 94 → 2.1 post DC01 isolation + credential rotation. ' +
    'S3 exfil surface eliminated after IAM Deny policy. ' +
    'C2 channel severed after DNS sinkhole of c2-exfil-proxy.top.',
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
    LOG_ANALYSIS: 'native-statistical',
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
    COORDINATOR: true, THREAT_INTEL: true, LOG_ANALYSIS: true, MALWARE: true, CLOUD: true,
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
