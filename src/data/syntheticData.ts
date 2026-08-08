/**
* AEGIS-X — Realistic Live-Attack Seed Dataset
*
* All timestamps are computed relative to NOW at module load time.
* This means every browser session shows "X minutes ago" — never a stale date.
*
* Narrative: Coordinated APT-29 style intrusion detected in progress.
*   T-62m  Phishing ISO delivered to finance workstation (WRK-FINANCE-09)
*   T-48m  DLL side-load executes Cobalt Strike beacon (initial foothold)
*   T-38m  Beacon connects to C2, dumps LSASS on domain controller DC01
*   T-22m  Kerberoasting TGS-REQ burst, RC4 tickets for 14 SPNs extracted
*   T-14m  AWS STS AssumeRole from TOR exit node; S3 data-lake enumeration
*   T-8m   4.2 GB PII exfiltration starts to AS201814 (Mullvad)
*   T-4m   Container escape on k8s-worker-node-04, C2 beacon port 8443
*   T-2m   DNS tunneling detected; honey-token in HONEY-VAULT-DB accessed
*   NOW    All agents active. Coordinator dispatching containment playbooks.
*/

import {
  Incident,
  AgentMetrics,
  EvidenceItem,
  DecisionIntelligence,
  IOCItem,
  NetworkNode,
  DigitalTwinState,
  AuditBlock,
  SOCReport,
  SOCSettings,
  SystemHealthMetrics,
} from '../types/soc';

// All timestamps are relative to module load — always "live"
const _T = Date.now();
const t = (minutesAgo: number) => new Date(_T - minutesAgo * 60_000).toISOString();

// ─── INCIDENTS ────────────────────────────────────────────────────────────────

export const INITIAL_INCIDENTS: Incident[] = [
  // ── INC-001 · Honey-Token Trigger (T-2m) ──────────────────────────────────
  {
    id: 'INC-2026-9046',
    title: 'Deception Honey-Token Triggered — SQL Vault Credential Accessed',
    severity: 'HIGH',
    status: 'TRIAGED',
    asset: {
      id: 'AST-HONEY-01',
      hostname: 'HONEY-VAULT-DB',
      ip: '10.99.99.15',
      type: 'Deception Asset',
      criticality: 'LOW',
      owner: 'Security Operations — Deception Mesh',
    },
    source: 'AEGIS-X Deception Engine / Canary Token Grid',
    mitreTechnique: { id: 'T1083', name: 'File and Directory Discovery', tactic: 'Discovery' },
    confidence: 99,
    riskScore: 89,
    dissentScore: 2,
    timestamp: t(2),
    description:
      'Canary SQL credential "aegis_readonly_svc / Vault#Prod2026!" stored in deception vault ' +
      'HONEY-VAULT-DB was read by internal host 10.10.8.44 (WRK-OFFSHORE-14) at ' +
      t(2) + '. This asset has zero legitimate access baseline. Access via ODBC connection ' +
      'string extraction from memory of process explorer.exe PID 3312. ' +
      'Attacker pivot confirmed — same IP initiated SMB admin$ enumeration 90 seconds later.',
    assignedAgent: 'DECEPTION',
    affectedSystemsCount: 1,
    containmentImpact: 'Deception asset holds no production data. Quarantining 10.10.8.44 causes zero business disruption.',
    businessImpact: 'Zero direct data loss. High-fidelity indicator of active lateral movement across corp-lan segment.',
    recommendedAction: 'Quarantine host 10.10.8.44 (WRK-OFFSHORE-14) immediately. Inspect all active SMB sessions and logon tokens. Revoke NTLM hash for svc_deception_sql account.',
    counterfactualExplanation:
      'Deception assets carry zero legitimate traffic by design. Any access is a confirmed indicator of compromise (IOC). ' +
      'False positive probability: 0.04%. Likelihood Ratio 42.0 is driven by the zero-baseline access model.',
    likelihoodRatio: 42.0,
    predictedNextTarget: 'DC01-PROD-EAST via SMB lateral move (91% probability)',
  },

  // ── INC-002 · LSASS Dump + Kerberoasting on DC01 (T-22m) ──────────────────
  {
    id: 'INC-2026-9041',
    title: 'LSASS Memory Dump + Kerberoasting Burst on Domain Controller DC01-PROD-EAST',
    severity: 'CRITICAL',
    status: 'INVESTIGATING',
    asset: {
      id: 'AST-001',
      hostname: 'DC01-PROD-EAST',
      ip: '10.142.4.10',
      type: 'Domain Controller',
      criticality: 'CRITICAL',
      owner: 'Identity & Access Team',
    },
    source: 'CrowdStrike Falcon EDR + Windows Active Directory Security Audit',
    mitreTechnique: { id: 'T1003.001', name: 'OS Credential Dumping: LSASS Memory', tactic: 'Credential Access' },
    confidence: 96,
    riskScore: 94,
    dissentScore: 8,
    timestamp: t(22),
    description:
      'CrowdStrike Falcon sensor on DC01-PROD-EAST (10.142.4.10) detected ' +
      'powershell.exe (PID 4108) opening lsass.exe (PID 684) with access mask 0x1F3FFF ' +
      '(PROCESS_ALL_ACCESS) at ' + t(38) + '. ' +
      'MiniDumpWriteDump() API call confirmed via API call telemetry. ' +
      'Dump written to C:\\Windows\\Temp\\debug_7f3a.dmp (148 MB). ' +
      'Immediately followed by Kerberos TGS-REQ burst: 14 service ticket requests ' +
      'for SPNs including MSSQLSvc, HTTP/SharePoint, CIFS/fileserver within 90 seconds, ' +
      'all requesting RC4-HMAC (0x17) downgrade (Kerberoasting indicator). ' +
      'Source workstation WRK-FINANCE-09 (10.10.44.9) matches initial phishing victim.',
    assignedAgent: 'COORDINATOR',
    affectedSystemsCount: 14,
    containmentImpact:
      'Isolating DC01-PROD-EAST triggers automatic DC02-PROD-EAST failover. ' +
      'Active Directory replication lag <3 seconds. Zero Kerberos authentication disruption for modern Kerberos-aware clients.',
    businessImpact:
      'If krbtgt hash is extracted, attacker can forge Golden Tickets valid for 10 years. ' +
      'Enterprise-wide domain compromise would affect 8,400 users and 2,100 managed endpoints.',
    recommendedAction:
      'IMMEDIATE: Isolate DC01-PROD-EAST at network layer. ' +
      'Reset krbtgt password twice (24h apart per MS guidance). ' +
      'Invalidate all Kerberos tickets. Force re-authentication across domain. ' +
      'Purge dump file C:\\Windows\\Temp\\debug_7f3a.dmp. ' +
      'Rotate all 14 SPN account passwords extracted in Kerberoast.',
    counterfactualExplanation:
      'If lsass.exe access were from a legitimate antivirus process, access mask would be 0x1000 (PROCESS_QUERY_LIMITED_INFORMATION), not 0x1F3FFF. ' +
      'RC4 downgrade on TGS-REQ is impossible from legitimate Kerberos clients on Windows Server 2025 (AES enforced by default GPO). ' +
      'Combined evidence leaves zero ambiguity.',
    likelihoodRatio: 18.4,
    predictedNextTarget: 'k8s-cluster-api (88% Risk) — service account tokens stored in etcd',
  },

  // ── INC-003 · AWS S3 IAM Exfiltration (T-8m) ──────────────────────────────
  {
    id: 'INC-2026-9042',
    title: 'Unauthorized AWS STS AssumeRole + S3 PII Exfiltration (4.2 GB) via TOR',
    severity: 'CRITICAL',
    status: 'CONTAINMENT_PENDING',
    asset: {
      id: 'AST-089',
      hostname: 'aws-prod-data-lake-s3',
      ip: '172.31.12.88',
      type: 'AWS S3 Bucket',
      criticality: 'CRITICAL',
      owner: 'Data Engineering',
    },
    source: 'AWS CloudTrail + Amazon GuardDuty + Macie PII Scanner',
    mitreTechnique: { id: 'T1530', name: 'Data from Cloud Storage Object', tactic: 'Collection' },
    confidence: 92,
    riskScore: 91,
    dissentScore: 12,
    timestamp: t(8),
    description:
      'AWS CloudTrail logged AssumeRole API call for arn:aws:iam::381492057841:role/SecurityOpsAdminRole ' +
      'from source IP 185.220.101.45 (TOR exit node, AS201814 Mullvad VPN) at ' + t(14) + '. ' +
      'Session token issued: AQoXnyc3FIAA... (truncated). ' +
      'GuardDuty finding: UnauthorizedAccess:IAMUser/TorIPCaller (severity 8.9/10). ' +
      'S3 API activity: ListBuckets → GetBucketLocation → ListObjectsV2 on s3://prod-datalake-pii-us-east-1. ' +
      'GetObject requests for 4,218 files matching pattern customers/2026/*/profile_*.parquet. ' +
      'Total egress: 4,219,715,660 bytes (4.2 GB) over 8 minutes to 185.220.101.45:443 (HTTPS). ' +
      'Amazon Macie confirmed PII classification: SSN, DOB, credit card PANs, email addresses.',
    assignedAgent: 'CLOUD',
    affectedSystemsCount: 3,
    containmentImpact:
      'Attach explicit Deny * inline IAM policy to SecurityOpsAdminRole. ' +
      'Revoke active STS session token AQoXnyc3FIAA. ' +
      'Enable S3 Block Public Access and MFA-delete. Zero microservice impact (IAM role not used by any running service).',
    businessImpact:
      'GDPR Article 33 breach notification required within 72 hours. ' +
      'CCPA notification to 4,218+ affected California residents. ' +
      'Estimated regulatory fine exposure: $2.8M–$14M depending on jurisdiction. ' +
      'Reputational damage if disclosed publicly before containment.',
    recommendedAction:
      'CRITICAL — HUMAN APPROVAL REQUIRED. ' +
      'Step 1: aws iam put-role-policy --role-name SecurityOpsAdminRole --policy-name EmergencyDeny --policy-document {"Statement":[{"Effect":"Deny","Action":"*","Resource":"*"}]}. ' +
      'Step 2: aws sts revoke-session --token AQoXnyc3FIAA. ' +
      'Step 3: Enable S3 object lock on prod-datalake-pii-us-east-1. ' +
      'Step 4: Engage legal and DPO for GDPR Article 33 timeline.',
    counterfactualExplanation:
      'If source IP 185.220.101.45 were in the approved developer VPN CIDR 10.100.0.0/16, this would be a routine admin operation. ' +
      'TOR exit node classification (AS201814) with 14,200 AbuseIPDB reports eliminates benign hypothesis. ' +
      'Credential for SecurityOpsAdminRole was likely extracted from Kerberoast SPN dump on DC01 5 minutes prior.',
    likelihoodRatio: 14.2,
    predictedNextTarget: 'aws-iam-master-role (91% Risk) — privilege escalation path via iam:PassRole',
  },

  // ── INC-004 · Container Escape k8s-worker-node-04 (T-4m) ──────────────────
  {
    id: 'INC-2026-9043',
    title: 'Container Escape to Host + C2 Beacon on k8s-worker-node-04',
    severity: 'HIGH',
    status: 'TRIAGED',
    asset: {
      id: 'AST-104',
      hostname: 'k8s-worker-node-04',
      ip: '10.240.1.54',
      type: 'Kubernetes Worker Node',
      criticality: 'HIGH',
      owner: 'Platform Engineering',
    },
    source: 'Falco Runtime Security + Cilium Network Policy Engine',
    mitreTechnique: { id: 'T1611', name: 'Escape to Host', tactic: 'Privilege Escalation' },
    confidence: 88,
    riskScore: 82,
    dissentScore: 15,
    timestamp: t(4),
    description:
      'Falco rule container_escape_via_nsenter fired on k8s-worker-node-04 at ' + t(4) + '. ' +
      'Pod payment-gateway-v2 (namespace: payments, service account: pmt-svc-account) ' +
      'executed: nsenter --target 1 --mount --uts --ipc --net --pid -- bash. ' +
      'This requires CAP_SYS_ADMIN which was granted via misconfigured securityContext.privileged: true ' +
      'in deployment payment-gateway-v2 (deployed 6 days ago, ticket PLAT-4821). ' +
      'Post-escape: attacker read /proc/1/environ (host env vars), ' +
      'mounted hostPath /var/lib/kubelet/pods to access other pod secrets, ' +
      'initiated outbound TCP connection to 91.108.4.44:8443 (Cobalt Strike Beacon C2, ' +
      'AS62041 Serverius Connectivity). Beacon check-in interval: 60 seconds.',
    assignedAgent: 'MALWARE',
    affectedSystemsCount: 8,
    containmentImpact:
      'kubectl cordon k8s-worker-node-04 prevents new pod scheduling. ' +
      'kubectl drain --delete-emptydir-data --ignore-daemonsets reschedules 12 pods to nodes 01-03. ' +
      'Estimated 15% capacity reduction on payment processing path. ETA to full capacity: 8 minutes.',
    businessImpact:
      'Attacker has read access to secrets from all pods previously co-located on this node. ' +
      'payment-gateway-v2 service account token can be used to authenticate to kube-apiserver. ' +
      'Risk of cluster-wide privilege escalation if ClusterRoleBinding exists (under investigation).',
    recommendedAction:
      'kubectl cordon k8s-worker-node-04. ' +
      'kubectl drain k8s-worker-node-04 --delete-emptydir-data --ignore-daemonsets. ' +
      'Delete pmt-svc-account ServiceAccount and rotate all pod secrets on the node. ' +
      'Block outbound TCP to 91.108.4.44 at Cilium NetworkPolicy level. ' +
      'Patch securityContext.privileged: false on all deployments.',
    counterfactualExplanation:
      'Without privileged: true in pod securityContext, nsenter requires explicit CAP_SYS_ADMIN grant. ' +
      'The misconfiguration in PLAT-4821 is the root cause. Removing privileged mode prevents this class of escape entirely.',
    likelihoodRatio: 9.8,
    predictedNextTarget: 'kube-apiserver (host) via service account token credential theft (85% Risk)',
  },

  // ── INC-005 · Lateral Move Pass-the-Hash Finance WS (T-38m) ──────────────
  {
    id: 'INC-2026-9044',
    title: 'Pass-the-Hash Lateral Movement from Finance Workstation to File Server',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    asset: {
      id: 'AST-033',
      hostname: 'WRK-FINANCE-09',
      ip: '10.10.44.9',
      type: 'Workstation',
      criticality: 'HIGH',
      owner: 'Finance Operations',
    },
    source: 'Splunk SIEM + Microsoft Defender for Endpoint + Windows Security Event Log',
    mitreTechnique: { id: 'T1550.002', name: 'Use Alternate Authentication Material: Pass the Hash', tactic: 'Lateral Movement' },
    confidence: 84,
    riskScore: 79,
    dissentScore: 18,
    timestamp: t(38),
    description:
      'Windows Security Event 4624 (Logon Type 3, NTLM) logged on FILESERVER-CORP (10.10.4.20) ' +
      'from WRK-FINANCE-09 (10.10.44.9) at ' + t(38) + ' using account CORP\\finance_svc_share. ' +
      'Logon was preceded by Event 4648 (Explicit Credential Logon) with mismatched ' +
      'source workstation hostname — indicator of PtH via Mimikatz sekurlsa::pth. ' +
      'Mimikatz binary hash: 4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b (64/68 VT engines). ' +
      'Process tree: invoice_august.iso → setup.exe → svchost.exe (injected) → ' +
      'cmd.exe → mimikatz.exe → sekurlsa::pth /user:finance_svc_share /domain:CORP /ntlm:aad3b435b51404eeaad3b435b51404ee. ' +
      'Access to \\\\FILESERVER-CORP\\Finance$ confirmed: 842 files enumerated in 12 seconds.',
    assignedAgent: 'INCIDENT_RESPONSE',
    affectedSystemsCount: 4,
    containmentImpact:
      'Network isolation of WRK-FINANCE-09 via EDR policy. ' +
      'Single workstation — no shared services running. Zero production impact.',
    businessImpact:
      'finance_svc_share account used for automated payroll batch scripts. ' +
      'If attacker modifies payroll CSV templates on FILESERVER-CORP, financial fraud risk is HIGH. ' +
      'Forensic analysis of \\\\FILESERVER-CORP\\Finance$ access log required urgently.',
    recommendedAction:
      'Isolate WRK-FINANCE-09 via CrowdStrike Network Containment. ' +
      'Reset NTLM hash for finance_svc_share across all domain controllers. ' +
      'Enable Protected Users security group for all service accounts. ' +
      'Review FILESERVER-CORP audit logs for file modification events (4663).',
    counterfactualExplanation:
      'NTLM Event 4624 Type 3 from a workstation to a file server is common. ' +
      'The distinguishing indicator is Event 4648 with mismatched source hostname and ' +
      'the Mimikatz binary hash match on VT (64/68 engines). ' +
      'Without the hash match, this would be LOW confidence.',
    likelihoodRatio: 8.1,
    predictedNextTarget: 'DC01-PROD-EAST via PtH with domain admin hash (79% Risk)',
  },

  // ── INC-006 · DNS Tunneling C2 (T-62m) ────────────────────────────────────
  {
    id: 'INC-2026-9045',
    title: 'DNS Tunneling C2 Channel: High-Rate Base64 TXT Queries to c2-exfil-proxy.top',
    severity: 'MEDIUM',
    status: 'INVESTIGATING',
    asset: {
      id: 'AST-201',
      hostname: 'DNS-RESOLVER-INT-01',
      ip: '10.0.0.53',
      type: 'DNS Server',
      criticality: 'HIGH',
      owner: 'Network Infrastructure',
    },
    source: 'Palo Alto DNS Security + Zeek PCAP Analysis + Splunk UBA',
    mitreTechnique: { id: 'T1071.004', name: 'Application Layer Protocol: DNS', tactic: 'Command and Control' },
    confidence: 76,
    riskScore: 62,
    dissentScore: 22,
    timestamp: t(62),
    description:
      'Palo Alto DNS Security flagged anomalous TXT query pattern at ' + t(62) + '. ' +
      'Queries to c2-exfil-proxy.top: 1,420 TXT requests over 58 minutes, avg 24.5 req/min ' +
      '(baseline: 0.2 req/min for .top TLD). ' +
      'Query labels are Base64-encoded: ' +
      'aGVhcnRiZWF0XzE3MjMwNzY4MDA=.c2-exfil-proxy.top (decoded: heartbeat_1723076800). ' +
      'Response TXT records contain Base64 command payloads (avg 248 bytes each). ' +
      'Zeek PCAP confirms DNS-over-UDP port 53 — not HTTPS, no certificate validation bypass. ' +
      'Source IPs: 10.10.44.9 (WRK-FINANCE-09 — matches INC-2026-9044), 10.240.1.54 (k8s-worker-node-04). ' +
      'Same C2 domain serves both endpoints — single attacker infrastructure confirmed.',
    assignedAgent: 'EDGE',
    affectedSystemsCount: 2,
    containmentImpact:
      'DNS sinkhole c2-exfil-proxy.top at internal resolver DNS-RESOLVER-INT-01. ' +
      'Add RPZ (Response Policy Zone) entry. Zero business disruption. ' +
      'Block domain at Palo Alto URL filtering as DNS-Tunneling category.',
    businessImpact:
      'C2 channel used for command dispatch and potential secondary payload download. ' +
      'Disrupting C2 may cause attacker to switch protocol or accelerate attack timeline.',
    recommendedAction:
      'Sinkhole c2-exfil-proxy.top at DNS level (RPZ). ' +
      'Block AS204428 (Serverius Connectivity) at perimeter firewall. ' +
      'Capture and decode all TXT response payloads from last 60 minutes for command reconstruction. ' +
      'Correlate with INC-2026-9044 timeline.',
    counterfactualExplanation:
      'High DNS query rate alone is insufficient — CDN providers generate similar patterns. ' +
      'The Base64 query label structure, .top TLD, AbuseIPDB score 82, and cross-correlation ' +
      'with two confirmed compromised hosts makes this a HIGH confidence secondary C2 channel.',
    likelihoodRatio: 4.5,
    predictedNextTarget: 'All corp-lan hosts via DNS-based command broadcast (64% Risk)',
  },
];

// ─── AGENTS ───────────────────────────────────────────────────────────────────

export const INITIAL_AGENTS: AgentMetrics[] = [
  {
    role: 'COORDINATOR',
    name: 'AEGIS Coordinator Prime',
    status: 'ANALYZING',
    model: 'gemini-2.0-flash',
    queueLength: 3,
    healthPercent: 99.4,
    latencyMs: 142,
    memoryUsageMb: 824,
    avgConfidence: 94.2,
    reliabilityWeight: 0.98,
    totalRequests: 14820,
    toolCalls: 38400,
    errorCount: 3,
    cacheHitRate: 88.5,
    executionTimeMs: 180,
    uptimePercent: 99.99,
    lastExecution: t(0),
    description: 'Orchestrating multi-agent investigation for INC-2026-9041 (CRITICAL). Dispatching containment playbook KERBEROS_RESPONSE_v4 to Incident Response agent. Awaiting human approval token for DC01 network isolation.',
  },
  {
    role: 'THREAT_INTEL',
    name: 'Threat Intelligence Engine',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 100.0,
    latencyMs: 84,
    memoryUsageMb: 512,
    avgConfidence: 92.1,
    reliabilityWeight: 0.95,
    totalRequests: 32100,
    toolCalls: 91200,
    errorCount: 1,
    cacheHitRate: 94.2,
    executionTimeMs: 95,
    uptimePercent: 100.0,
    lastExecution: t(2),
    description: 'Last IOC lookup: 185.220.101.45 → TOR exit node AS201814. VT score 78/92. AbuseIPDB: 14,200 reports. Cross-matched to APT29 Cobalt Strike infrastructure. IOC cached with 1h TTL.',
  },
  {
    role: 'MALWARE',
    name: 'Malware & Binary Analysis Unit',
    status: 'EXECUTING',
    model: 'gemini-2.0-flash',
    queueLength: 1,
    healthPercent: 98.2,
    latencyMs: 310,
    memoryUsageMb: 1240,
    avgConfidence: 91.5,
    reliabilityWeight: 0.94,
    totalRequests: 9420,
    toolCalls: 18300,
    errorCount: 12,
    cacheHitRate: 72.4,
    executionTimeMs: 380,
    uptimePercent: 99.95,
    lastExecution: t(1),
    description: 'YARA scan running on darkside_loader.dll (SHA256: 4a8b9c0d...). Static disassembly confirms Cobalt Strike 4.9.1 artifact. Extracting C2 configuration from .data section offset 0x4A20. Named pipe: \\\\pipe\\msagent_84.',
  },
  {
    role: 'CLOUD',
    name: 'Cloud Security & IAM Auditor',
    status: 'ANALYZING',
    model: 'gemini-2.0-flash',
    queueLength: 2,
    healthPercent: 99.8,
    latencyMs: 110,
    memoryUsageMb: 640,
    avgConfidence: 95.8,
    reliabilityWeight: 0.97,
    totalRequests: 21900,
    toolCalls: 45200,
    errorCount: 2,
    cacheHitRate: 91.0,
    executionTimeMs: 120,
    uptimePercent: 99.98,
    lastExecution: t(1),
    description: 'Auditing SecurityOpsAdminRole trust policy. Identified iam:PassRole to 3 child roles. GuardDuty finding IAMUser/TorIPCaller severity 8.9 escalated. Drafting emergency Deny * inline policy for human approval.',
  },
  {
    role: 'INCIDENT_RESPONSE',
    name: 'Incident Response & Playbook Engine',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 100.0,
    latencyMs: 92,
    memoryUsageMb: 480,
    avgConfidence: 96.2,
    reliabilityWeight: 0.99,
    totalRequests: 11200,
    toolCalls: 22400,
    errorCount: 0,
    cacheHitRate: 89.8,
    executionTimeMs: 105,
    uptimePercent: 100.0,
    lastExecution: t(3),
    description: 'Playbook KERBEROS_RESPONSE_v4 staged. Awaiting COORDINATOR approval. Pre-staged: CrowdStrike network containment API call for DC01-PROD-EAST, krbtgt double-reset sequence, WRK-FINANCE-09 isolation. Estimated execution time: 47 seconds.',
  },
  {
    role: 'COMPLIANCE',
    name: 'Compliance & Governance Inspector',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 100.0,
    latencyMs: 78,
    memoryUsageMb: 390,
    avgConfidence: 97.5,
    reliabilityWeight: 0.96,
    totalRequests: 8400,
    toolCalls: 12100,
    errorCount: 0,
    cacheHitRate: 96.1,
    executionTimeMs: 82,
    uptimePercent: 100.0,
    lastExecution: t(8),
    description: 'GDPR Article 33 breach notification clock started for INC-2026-9042 (S3 PII exfil). 71h 52m remaining. CCPA Section 1798.82 notification draft queued for DPO review. SOC 2 Type II evidence package being compiled.',
  },
  {
    role: 'EDGE',
    name: 'Edge & Network Telemetry Agent',
    status: 'ANALYZING',
    model: 'gemini-2.0-flash',
    queueLength: 1,
    healthPercent: 99.1,
    latencyMs: 68,
    memoryUsageMb: 520,
    avgConfidence: 89.4,
    reliabilityWeight: 0.92,
    totalRequests: 48900,
    toolCalls: 112000,
    errorCount: 5,
    cacheHitRate: 95.3,
    executionTimeMs: 70,
    uptimePercent: 99.99,
    lastExecution: t(0),
    description: 'Correlating Zeek DNS PCAP logs for c2-exfil-proxy.top. Detected 1,420 TXT queries over 58 minutes. Netflow shows 4.2 GB egress to AS201814 (Mullvad) on port 443. BGP anomaly: new route advertisement for 185.220.101.0/24 at T-70m.',
  },
  {
    role: 'DECEPTION',
    name: 'Deception Mesh Sentinel',
    status: 'IDLE',
    model: 'gemini-2.0-flash',
    queueLength: 0,
    healthPercent: 100.0,
    latencyMs: 52,
    memoryUsageMb: 310,
    avgConfidence: 99.2,
    reliabilityWeight: 0.99,
    totalRequests: 6200,
    toolCalls: 18400,
    errorCount: 0,
    cacheHitRate: 98.4,
    executionTimeMs: 55,
    uptimePercent: 100.0,
    lastExecution: t(2),
    description: 'HONEY-VAULT-DB canary token accessed at T-2m by 10.10.8.44. Honeypot SSH server logged 3 connection attempts from same IP. Deploying additional canary credentials to \\\\FILESERVER-CORP\\Finance$ to track attacker file access patterns.',
  },
  {
    role: 'HUMAN',
    name: 'Human-in-the-Loop Analyst Liaison',
    status: 'IDLE',
    model: 'human-in-the-loop',
    queueLength: 1,
    healthPercent: 100.0,
    latencyMs: 180000,
    memoryUsageMb: 0,
    avgConfidence: 100,
    reliabilityWeight: 1.0,
    totalRequests: 1420,
    toolCalls: 1420,
    errorCount: 0,
    cacheHitRate: 0,
    executionTimeMs: 180000,
    uptimePercent: 100.0,
    lastExecution: t(8),
    description: 'PENDING APPROVAL: DC01-PROD-EAST network isolation (INC-2026-9041, risk 94/100). AWS SecurityOpsAdminRole Deny policy attachment (INC-2026-9042, risk 91/100). SOC Lead notification dispatched via PagerDuty P1 alert.',
  },
  {
    role: 'LOG_ANALYSIS',
    name: 'Log Correlation & Statistical Engine',
    status: 'ANALYZING',
    model: 'native-statistical',
    queueLength: 4,
    healthPercent: 99.6,
    latencyMs: 195,
    memoryUsageMb: 950,
    avgConfidence: 96.5,
    reliabilityWeight: 0.98,
    totalRequests: 28900,
    toolCalls: 68100,
    errorCount: 1,
    cacheHitRate: 92.8,
    executionTimeMs: 210,
    uptimePercent: 99.99,
    lastExecution: t(0),
    description: 'Processing 284,000 log lines/sec from Splunk HEC. Identified 6 distinct kill-chain stages across 5 hosts. EWMA anomaly score: 4.8σ above baseline. Correlated INC-9041 → INC-9044 → INC-9042 as single campaign (confidence 94.1%).',
  },
];

// ─── EVIDENCE ─────────────────────────────────────────────────────────────────

export const INITIAL_EVIDENCE: EvidenceItem[] = [
  {
    id: 'EVD-101',
    incidentId: 'INC-2026-9041',
    timestamp: t(38),
    type: 'MEMORY',
    source: 'CrowdStrike Falcon Sensor v7.12 — DC01-PROD-EAST',
    rawContent:
      '[ALERT] Process memory access detected.\n' +
      'Target process: lsass.exe (PID 684, SYSTEM)\n' +
      'Accessor: powershell.exe (PID 4108, CORP\\SYSTEM)\n' +
      'Access mask: 0x1F3FFF (PROCESS_ALL_ACCESS)\n' +
      'API: MiniDumpWriteDump()\n' +
      'Output file: C:\\Windows\\Temp\\debug_7f3a.dmp (148,234,240 bytes)\n' +
      'SHA256 of dump: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2\n' +
      'Sensor prevention: ALLOWED (prevention policy: Audit-Only for LSASS)\n' +
      'Recommendation: Upgrade LSASS protection policy to PREVENT.',
    weight: 10,
    confidence: 98,
    mitreId: 'T1003.001',
    toolUsed: 'CrowdStrike Falcon EDR Sensor v7.12',
    hash: '8f3a1c9e8d2b0e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8',
    flaggedByAgent: 'MALWARE',
  },
  {
    id: 'EVD-102',
    incidentId: 'INC-2026-9041',
    timestamp: t(22),
    type: 'LOG',
    source: 'Windows Security Event Log — DC01-PROD-EAST (Event 4769)',
    rawContent:
      'Log Name:      Security\n' +
      'Source:        Microsoft Windows security auditing.\n' +
      'Event ID:      4769 — A Kerberos service ticket was requested.\n' +
      'Account Name:  WRK-FINANCE-09$\n' +
      'Account Domain: CORP\n' +
      'Service Name:  MSSQLSvc/SQLSERVER01.corp.local:1433\n' +
      'Service ID:    CORP\\sql_svc_prod\n' +
      'Ticket Options: 0x40810000\n' +
      'Ticket Encryption Type: 0x17 (RC4-HMAC) ← DOWNGRADE DETECTED\n' +
      'Client Address: ::ffff:10.10.44.9\n' +
      'Client Port: 49821\n' +
      '[AEGIS NOTE] 14 TGS-REQ with RC4 encryption in 90s window. Kerberoasting pattern confirmed.',
    weight: 9,
    confidence: 96,
    mitreId: 'T1558.003',
    toolUsed: 'Windows Security Event Subsystem — SIEM Splunk Forwarder',
    hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
    flaggedByAgent: 'COORDINATOR',
  },
  {
    id: 'EVD-103',
    incidentId: 'INC-2026-9041',
    timestamp: t(24),
    type: 'NETWORK',
    source: 'Zeek Network Monitor — SPAN Port CORE-SW-01',
    rawContent:
      '#separator \\x09\n' +
      '#fields  ts  uid  id.orig_h  id.orig_p  id.resp_h  id.resp_p  proto  service\n' +
      `${t(24)}  C1a2b3  10.10.44.9  49821  10.142.4.10  445  tcp  smb\n` +
      'smb_cmd: SMB2_SESSION_SETUP\n' +
      'user: CORP\\administrator (HARVESTED CREDENTIAL)\n' +
      'auth_type: NTLMSSP\n' +
      'share: admin$\n' +
      'status: SUCCESS — Session ID 0x00000000000A1C4F\n' +
      'files_accessed: [C$\\Windows\\System32\\config\\SAM]\n' +
      '[AEGIS NOTE] SMB lateral move from Kerberoast source. Admin$ access with harvested hash.',
    weight: 8,
    confidence: 91,
    mitreId: 'T1021.002',
    toolUsed: 'Zeek Network Security Monitor v6.0.3',
    hash: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8',
    flaggedByAgent: 'EDGE',
  },
  {
    id: 'EVD-104',
    incidentId: 'INC-2026-9041',
    timestamp: t(20),
    type: 'AUTH',
    source: 'Okta Identity Engine — MFA Audit Log',
    rawContent:
      'eventType: user.mfa.okta_verify.push.sent\n' +
      'actor: admin_svc_it@corp.local\n' +
      'client.userAgent: python-requests/2.31.0 (NOT a browser — automation indicator)\n' +
      'client.ipAddress: 10.10.44.9 (WRK-FINANCE-09 — confirmed compromised)\n' +
      'client.geographicalContext: { city: "Austin", state: "Texas", country: "US" }\n' +
      'eventType: user.mfa.okta_verify.push.auto_accept (MFA Fatigue Attack)\n' +
      'timestamp: ' + t(20) + '\n' +
      'outcome: SUCCESS — session token issued\n' +
      '[AEGIS NOTE] MFA push auto-accepted after 3 previous denials in 8 minutes. MFA fatigue attack pattern.',
    weight: 9,
    confidence: 95,
    mitreId: 'T1621',
    toolUsed: 'Okta Identity Engine API v2 — SIEM Integration',
    hash: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4',
    flaggedByAgent: 'THREAT_INTEL',
  },
  {
    id: 'EVD-105',
    incidentId: 'INC-2026-9042',
    timestamp: t(14),
    type: 'LOG',
    source: 'AWS CloudTrail — us-east-1 (Account 381492057841)',
    rawContent:
      '{\n' +
      '  "eventVersion": "1.08",\n' +
      '  "eventTime": "' + t(14) + '",\n' +
      '  "eventSource": "sts.amazonaws.com",\n' +
      '  "eventName": "AssumeRole",\n' +
      '  "sourceIPAddress": "185.220.101.45",\n' +
      '  "userAgent": "aws-cli/2.13.4 Python/3.11.4 Linux/5.15.0",\n' +
      '  "requestParameters": {\n' +
      '    "roleArn": "arn:aws:iam::381492057841:role/SecurityOpsAdminRole",\n' +
      '    "roleSessionName": "ops-session-1723076800",\n' +
      '    "durationSeconds": 3600\n' +
      '  },\n' +
      '  "responseElements": {\n' +
      '    "credentials": { "accessKeyId": "ASIA3FJLK7MZQXR8N2PW", "sessionToken": "AQoXnyc3FIAA..." }\n' +
      '  },\n' +
      '  "userIdentity": { "type": "IAMUser", "userName": "ci-deploy-prod" }\n' +
      '}\n' +
      '[AEGIS NOTE] ci-deploy-prod credentials used from TOR exit node. Credential theft confirmed from Kerberoast dump.',
    weight: 10,
    confidence: 97,
    mitreId: 'T1078.004',
    toolUsed: 'AWS CloudTrail + GuardDuty UnauthorizedAccess:IAMUser/TorIPCaller',
    hash: '2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
    flaggedByAgent: 'CLOUD',
  },
  {
    id: 'EVD-106',
    incidentId: 'INC-2026-9042',
    timestamp: t(8),
    type: 'NETWORK',
    source: 'AWS VPC Flow Logs — prod-vpc-us-east-1',
    rawContent:
      'version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes start end action\n' +
      `2 381492057841 eni-0a1b2c3d4e5f6a7b8 172.31.12.88 185.220.101.45 443 54832 6 34821 4219715660 ${Math.floor(new Date(t(14)).getTime() / 1000)} ${Math.floor(new Date(t(8)).getTime() / 1000)} ACCEPT\n` +
      '[AEGIS NOTE] 4,219,715,660 bytes (4.2 GB) egressed to TOR exit node over 6 minutes via HTTPS.\n' +
      'Macie finding: S3_OBJECT_CONTAINS_PII — SSN, PANs, DOB, email addresses confirmed in exfil payload.\n' +
      'GuardDuty: Exfiltration:S3/AnomalousBehavior (severity: 9.2/10)',
    weight: 10,
    confidence: 94,
    mitreId: 'T1048.002',
    toolUsed: 'AWS VPC Flow Logs + Amazon Macie + GuardDuty',
    hash: '4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5',
    flaggedByAgent: 'CLOUD',
  },
];

// ─── DECISION ─────────────────────────────────────────────────────────────────

export const INITIAL_DECISION: DecisionIntelligence = {
  incidentId: 'INC-2026-9041',
  finalProbability: 96.4,
  dissentLevel: 'LOW',
  dissentAgents: ['EDGE'],
  riskScore: 94,
  confidenceScore: 96,
  recommendedAction:
    'AUTONOMOUS CONTAINMENT STAGED — AWAITING HUMAN APPROVAL (SOC Lead required for CRITICAL actions):\n' +
    '① Network isolation of DC01-PROD-EAST via CrowdStrike Contain Host API\n' +
    '② Dual krbtgt password reset (T+0 and T+24h per MS AD recovery guidance)\n' +
    '③ Forced Kerberos ticket invalidation across all 8,400 domain members\n' +
    '④ Quarantine WRK-FINANCE-09 via Defender for Endpoint isolation policy\n' +
    '⑤ AWS SecurityOpsAdminRole emergency Deny * policy attachment\n' +
    'Estimated containment execution time: 47 seconds post-approval.',
  counterfactualExplanation:
    'If Okta MFA fatigue push were rejected (not auto-accepted), attacker cannot authenticate to AWS STS and S3 exfil does not occur. ' +
    'If LSASS protection policy were set to PREVENT (not Audit-Only) in CrowdStrike, credential dump fails at source and entire attack chain terminates. ' +
    'Root cause: (1) CrowdStrike policy gap on DC01, (2) missing MFA anomaly detection for python-requests user-agent.',
  businessImpact:
    'DC01 failover to DC02-PROD-EAST: zero Kerberos disruption, seamless (<3s replication lag). ' +
    'Finance workstation isolation: zero production impact (single endpoint). ' +
    'AWS IAM policy attachment: zero service interruption (role not in use by any running lambda/EC2). ' +
    'GDPR Article 33 notification: 71h 52m window remaining.',
  containmentImpact:
    'Risk score drops from 94 → 2.1 after DC01 isolation + credential rotation. ' +
    'S3 exfil surface eliminated after IAM Deny policy. ' +
    'C2 channel severed after DNS sinkhole of c2-exfil-proxy.top. ' +
    'Estimated attacker dwell time post-containment: 0 seconds.',
  approvalStatus: 'PENDING',
};

// ─── IOCs ─────────────────────────────────────────────────────────────────────

export const INITIAL_IOCS: IOCItem[] = [
  {
    value: '185.220.101.45',
    type: 'IP',
    reputation: 'MALICIOUS',
    confidence: 98,
    threatFamily: 'TOR Exit Node — APT29 Cobalt Strike Infrastructure / AS201814 Mullvad',
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
    threatFamily: 'Cobalt Strike Team Server — AS62041 Serverius Connectivity / Beacon C2 Port 8443',
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

// ─── NETWORK NODES ────────────────────────────────────────────────────────────

export const INITIAL_NETWORK_NODES: NetworkNode[] = [
  {
    id: 'N1', label: 'Perimeter FW (Palo Alto PA-5220)', type: 'GATEWAY',
    ip: '203.0.113.1', os: 'PAN-OS 11.1.2', riskLevel: 'CLEAN', status: 'ONLINE',
    vulnerabilitiesCount: 0, businessValue: 'HIGH', zone: 'dmz',
    connections: ['N2', 'N7'], vulnerabilityScore: 2.1, propagationStep: 0,
  },
  {
    id: 'N2', label: 'DC01-PROD-EAST (Domain Controller)', type: 'SERVER',
    ip: '10.142.4.10', os: 'Windows Server 2025 (Build 26100)', riskLevel: 'CRITICAL', status: 'COMPROMISED',
    vulnerabilitiesCount: 4, businessValue: 'HIGH', zone: 'corp-lan',
    connections: ['N1', 'N3', 'N4', 'N6'], vulnerabilityScore: 9.8, propagationStep: 1,
  },
  {
    id: 'N3', label: 'DC02-PROD-EAST (Backup DC)', type: 'SERVER',
    ip: '10.142.4.11', os: 'Windows Server 2025 (Build 26100)', riskLevel: 'WARNING', status: 'ONLINE',
    vulnerabilitiesCount: 1, businessValue: 'HIGH', zone: 'corp-lan',
    connections: ['N2', 'N8'], vulnerabilityScore: 5.8, propagationStep: 2,
  },
  {
    id: 'N4', label: 'PostgreSQL DB Cluster (Primary)', type: 'DATABASE',
    ip: '10.142.8.50', os: 'Ubuntu 24.04 LTS + PostgreSQL 16.2', riskLevel: 'DANGER', status: 'ONLINE',
    vulnerabilitiesCount: 2, businessValue: 'HIGH', zone: 'db-tier',
    connections: ['N2', 'N6'], vulnerabilityScore: 8.2, propagationStep: 2,
  },
  {
    id: 'N5', label: 'AWS S3 Data Lake (prod-datalake-pii)', type: 'CLOUD_INSTANCE',
    ip: '172.31.12.88', os: 'AWS S3 Managed', riskLevel: 'CRITICAL', status: 'COMPROMISED',
    vulnerabilitiesCount: 1, businessValue: 'HIGH', zone: 'cloud-data',
    connections: ['N7'], vulnerabilityScore: 9.1, propagationStep: 2,
  },
  {
    id: 'N6', label: 'WRK-FINANCE-09 (Finance Workstation)', type: 'WORKSTATION',
    ip: '10.10.44.9', os: 'Windows 11 Enterprise 23H2', riskLevel: 'DANGER', status: 'ONLINE',
    vulnerabilitiesCount: 3, businessValue: 'MEDIUM', zone: 'corp-lan',
    connections: ['N2', 'N4', 'N8'], vulnerabilityScore: 8.4, propagationStep: 1,
  },
  {
    id: 'N7', label: 'k8s-worker-node-04 (Payments)', type: 'CONTAINER',
    ip: '10.240.1.54', os: 'Ubuntu 24.04 LTS — containerd 1.7.12', riskLevel: 'WARNING', status: 'ONLINE',
    vulnerabilitiesCount: 5, businessValue: 'MEDIUM', zone: 'web-tier',
    connections: ['N1', 'N5'], vulnerabilityScore: 7.1, propagationStep: 2,
  },
  {
    id: 'N8', label: 'DNS-RESOLVER-INT-01 (Internal DNS)', type: 'SERVER',
    ip: '10.0.0.53', os: 'BIND 9.18 on Ubuntu 22.04', riskLevel: 'WARNING', status: 'ONLINE',
    vulnerabilitiesCount: 1, businessValue: 'LOW', zone: 'corp-lan',
    connections: ['N3', 'N6'], vulnerabilityScore: 4.2, propagationStep: 3,
  },
];

// ─── DIGITAL TWIN ─────────────────────────────────────────────────────────────

export const INITIAL_DIGITAL_TWIN: DigitalTwinState = {
  totalRiskBefore: 94.2,
  totalRiskAfter: 4.8,
  projectedVictimsBefore: 8400,
  projectedVictimsAfter: 1,
  affectedAssetsBefore: 14,
  affectedAssetsAfter: 1,
  estimatedBusinessCost: 14200000,
  estimatedContainmentCost: 47000,
  confidence: 96.5,
  containmentEffectiveness: 98.2,
};

// ─── AUDIT BLOCKS ─────────────────────────────────────────────────────────────

export const INITIAL_AUDIT_BLOCKS: AuditBlock[] = [
  {
    index: 1084,
    timestamp: t(0),
    hash: '0x8f2a9c1b3d5e7f9a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a',
    previousHash: '0x7e1a8b0c2d4e6f8a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a',
    actor: 'AEGIS-X :: COORDINATOR Agent',
    actorType: 'AI_AGENT',
    action: 'DISPATCH_CONTAINMENT_PLAYBOOK',
    incidentId: 'INC-2026-9041',
    verificationStatus: 'VALID',
    integrityProof: 'SHA256-HMAC-AEGIS-KEY-v3',
    details: {
      playbook: 'KERBEROS_RESPONSE_v4',
      targetAsset: 'DC01-PROD-EAST (10.142.4.10)',
      actions: ['HOST_NETWORK_ISOLATION', 'KRBTGT_DOUBLE_RESET', 'TICKET_INVALIDATION'],
      estimatedExecutionMs: 47000,
      awaitingHumanApproval: true,
      pageDutyAlertId: 'PD-8F2A9C1B',
    },
  },
  {
    index: 1083,
    timestamp: t(8),
    hash: '0x7e1a8b0c2d4e6f8a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a',
    previousHash: '0x6d0a7b9c1d3e5f7a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a',
    actor: 'AEGIS-X :: CLOUD Agent',
    actorType: 'AI_AGENT',
    action: 'FLAG_UNAUTHORIZED_IAM_ROLE_ASSUMPTION',
    incidentId: 'INC-2026-9042',
    verificationStatus: 'VALID',
    integrityProof: 'SHA256-HMAC-AEGIS-KEY-v3',
    details: {
      roleArn: 'arn:aws:iam::381492057841:role/SecurityOpsAdminRole',
      sourceIp: '185.220.101.45',
      asn: 'AS201814 Mullvad VPN AB',
      bytesExfiltrated: 4219715660,
      guardDutyFinding: 'UnauthorizedAccess:IAMUser/TorIPCaller',
      maciePiiTypes: ['SSN', 'CreditCard_PAN', 'DateOfBirth', 'EmailAddress'],
      gdprNotificationDeadline: new Date(_T + (72 * 60 - 8) * 60_000).toISOString(),
    },
  },
  {
    index: 1082,
    timestamp: t(22),
    hash: '0x6d0a7b9c1d3e5f7a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a',
    previousHash: '0x5c9a6b8c0d2e4f6a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a',
    actor: 'AEGIS-X :: MALWARE Agent',
    actorType: 'AI_AGENT',
    action: 'KERBEROAST_BURST_DETECTED',
    incidentId: 'INC-2026-9041',
    verificationStatus: 'VALID',
    integrityProof: 'SHA256-HMAC-AEGIS-KEY-v3',
    details: {
      spnCount: 14,
      encryptionType: '0x17 (RC4-HMAC — downgrade from AES256)',
      sourceIp: '10.10.44.9',
      targetDC: 'DC01-PROD-EAST',
      windowSeconds: 90,
      affectedSPNs: ['MSSQLSvc', 'HTTP/SharePoint', 'CIFS/fileserver', 'RestrictedKrbHost', 'TERMSRV'],
    },
  },
  {
    index: 1081,
    timestamp: t(38),
    hash: '0x5c9a6b8c0d2e4f6a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a',
    previousHash: '0x4b8a5b7c9d1e3f5a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a',
    actor: 'AEGIS-X :: MALWARE Agent',
    actorType: 'AI_AGENT',
    action: 'LSASS_MEMORY_DUMP_DETECTED',
    incidentId: 'INC-2026-9041',
    verificationStatus: 'VALID',
    integrityProof: 'SHA256-HMAC-AEGIS-KEY-v3',
    details: {
      targetProcess: 'lsass.exe (PID 684)',
      accessorProcess: 'powershell.exe (PID 4108)',
      accessMask: '0x1F3FFF (PROCESS_ALL_ACCESS)',
      dumpFile: 'C:\\Windows\\Temp\\debug_7f3a.dmp',
      dumpSizeBytes: 148234240,
      dumpSHA256: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      csPreventionPolicy: 'AUDIT_ONLY — policy gap identified',
    },
  },
  {
    index: 1080,
    timestamp: t(62),
    hash: '0x4b8a5b7c9d1e3f5a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a',
    previousHash: '0x3a7a4b6c8d0e2f4a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a',
    actor: 'AEGIS-X :: EDGE Agent',
    actorType: 'AI_AGENT',
    action: 'PHISHING_ISO_DELIVERY_DETECTED',
    incidentId: 'INC-2026-9044',
    verificationStatus: 'VALID',
    integrityProof: 'SHA256-HMAC-AEGIS-KEY-v3',
    details: {
      filename: 'invoice_august_2026.iso',
      sha256: '4a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
      vtScore: '64/68 MALICIOUS (Cobalt Strike Beacon)',
      deliveryMethod: 'Email attachment — Microsoft Exchange On-Premises',
      recipientEmail: 'f.martinez@corp.local',
      recipientHost: 'WRK-FINANCE-09 (10.10.44.9)',
      senderDomain: 'invoices-corp-accounting.com (typosquatted — registered T-4d)',
    },
  },
];

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export const INITIAL_REPORTS: SOCReport[] = [
  {
    id: 'RPT-LIVE-001',
    title: 'ACTIVE INCIDENT BRIEF — APT Campaign: Cobalt Strike + S3 PII Exfiltration (T-0)',
    category: 'INCIDENT_POST_MORTEM',
    generatedAt: t(1),
    author: 'AEGIS-X Coordinator + Fusion Engine',
    status: 'READY',
    summary:
      'ACTIVE ATTACK IN PROGRESS. 5 incidents across 6 hosts. APT campaign confirmed: ' +
      'phishing ISO → Cobalt Strike beacon → LSASS dump → Kerberoasting (14 SPNs) → AWS STS IAM abuse → ' +
      '4.2 GB PII exfiltration (S3) → container escape (k8s) → DNS C2 tunneling → honey-token triggered. ' +
      'Containment playbooks staged. Human approval pending for DC01 isolation and AWS IAM emergency policy.',
    incidentCount: 5,
    fileSizeMb: 8.4,
    mitreCoveragePercent: 97.2,
  },
  {
    id: 'RPT-GDPR-001',
    title: 'GDPR Article 33 Breach Notification Draft — S3 PII Exfiltration INC-2026-9042',
    category: 'COMPLIANCE',
    generatedAt: t(6),
    author: 'Compliance & Governance Inspector Agent',
    status: 'READY',
    summary:
      'Personal data breach affecting 4,218+ data subjects confirmed. ' +
      'Categories: SSN, credit card PANs, DOB, email addresses. ' +
      'Transfer: 4.2 GB to unauthorized third party (TOR network, AS201814). ' +
      'GDPR Article 33 notification to supervisory authority required within 72 hours. ' +
      '71h 54m remaining. DPO notification dispatched. Draft notification ready for legal review.',
    incidentCount: 1,
    fileSizeMb: 3.2,
    mitreCoveragePercent: 88.0,
  },
  {
    id: 'RPT-EXE-001',
    title: 'Q3 2026 SOC Executive Brief — Enterprise Threat Posture & AI Platform Performance',
    category: 'EXECUTIVE',
    generatedAt: new Date(_T - 7 * 24 * 60 * 60_000).toISOString(),
    author: 'AEGIS-X Autonomous Intelligence Platform',
    status: 'READY',
    summary:
      'Comprehensive analysis of 1,420 security events across Q3. ' +
      'Mean Time to Detect (MTTD): 42 seconds (industry avg: 197 days). ' +
      'Autonomous containment rate: 94.2% (6 human approvals required). ' +
      'MITRE ATT&CK coverage: 97.2% across 14 tactics. ' +
      'Zero successful domain compromises. $14.2M business impact prevented.',
    incidentCount: 142,
    fileSizeMb: 5.8,
    mitreCoveragePercent: 97.2,
  },
];

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

export const INITIAL_SETTINGS: SOCSettings = {
  riskThreshold: 75,
  dissentSensitivity: 'BALANCED',
  autoContainmentEnabled: true,
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
    HUMAN: 'gemini-2.0-flash',
    FUSION_ENGINE: 'gemini-2.0-flash',
  },
  agentEnabled: {
    COORDINATOR: true, THREAT_INTEL: true, LOG_ANALYSIS: true, MALWARE: true,
    CLOUD: true, INCIDENT_RESPONSE: true, COMPLIANCE: true, EDGE: true,
    DECEPTION: true, HUMAN: true, FUSION_ENGINE: true,
  },
  rateLimitPerMin: 1200,
  memoryLimitMb: 16384,
  apiKeySet: true,
  realtimeRefreshIntervalMs: 3000,
  supabaseStatus: 'CONNECTED',
  featureFlags: {
    experimentalChrononWave: true,
    conformalPrediction: true,
    autoEvidenceFusion: true,
    deceptionHoneyMesh: true,
  },
};

// ─── SYSTEM HEALTH ────────────────────────────────────────────────────────────

export const INITIAL_SYSTEM_HEALTH: SystemHealthMetrics = {
  cpuUsage: 22.4,
  memoryUsage: 48.1,
  apiStatus: 'HEALTHY',
  agentAvailability: 99.8,
  llmQueueDepth: 4,
  realtimeConnected: true,
  toolHealth: {
    siem: 'OPERATIONAL',
    edr: 'OPERATIONAL',
    firewall: 'OPERATIONAL',
    cloudLogs: 'OPERATIONAL',
  },
};
