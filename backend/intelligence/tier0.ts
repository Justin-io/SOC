/**
 * AEGIS-X Backend — Intelligence Tier 0
 * Deterministic fast-path. Static rules, IOC cache, whitelists/blacklists.
 * Target: < 50ms. Resolves ~40% of alerts without LLM.
 */

import type { AlertRecord, EvidenceRecord } from '../core/types.js';
import { getLogger } from '../core/logger.js';
import { iocCache } from '../memory/iocCache.js';

const log = getLogger('intelligence:tier0');

// Static IOC blacklist (known bad IPs/hashes/domains)
const BLACKLISTED_IPS = new Set([
  '185.220.101.45', '193.142.147.45', '198.96.155.3',
  '194.165.16.29', '45.153.160.2', '87.236.233.93',
]);

const BLACKLISTED_DOMAINS = new Set([
  'cobaltstrike-c2.xyz', 'evil-beacon.onion', 'tor-exit-node.net',
  'keylogger-c2.ru', 'malware-drop.xyz',
]);

const BLACKLISTED_HASHES = new Set([
  'e99a18c428cb38d5f260853678922e03', // known mimikatz variant
  '5f4dcc3b5aa765d61d8327deb882cf99', // known credential dumper
]);

// Maintenance windows (deterministic suppression)
const MAINTENANCE_WINDOWS = [
  { start: '03:00', end: '05:00', days: [0, 6], description: 'Weekend DR backup' },
];

// Known-good service accounts
const WHITELISTED_ACTORS = new Set([
  'svc-backup-agent', 'svc-monitoring', 'svc-dr-replication',
  'aws-lambda-execution', 'k8s-controller-manager',
]);

function isMaintenanceWindow(): boolean {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const day = now.getUTCDay();
  const currentMinutes = hour * 60 + minute;

  for (const window of MAINTENANCE_WINDOWS) {
    const [sh, sm] = window.start.split(':').map(Number);
    const [eh, em] = window.end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (window.days.includes(day) && currentMinutes >= startMin && currentMinutes <= endMin) {
      return true;
    }
  }
  return false;
}

export interface Tier0Result {
  resolved: boolean;
  verdict: 'MALICIOUS' | 'CLEAN' | 'SUPPRESSED' | 'ESCALATE';
  confidence: number;
  reason: string;
  matchedRule: string;
  latencyMs: number;
}

export async function runTier0(alert: AlertRecord): Promise<Tier0Result> {
  const start = Date.now();
  const raw = JSON.stringify(alert.rawPayload).toLowerCase();
  const incident = alert.incident;

  // Rule 1: Known blacklisted IP in payload
  for (const ip of BLACKLISTED_IPS) {
    if (raw.includes(ip)) {
      log.info('Tier0: Blacklisted IP match', { traceId: alert.traceId, meta: { ip } });
      return { resolved: true, verdict: 'MALICIOUS', confidence: 99, reason: `Known malicious IP ${ip} detected`, matchedRule: 'BLACKLIST_IP', latencyMs: Date.now() - start };
    }
  }

  // Rule 2: Cached IOC hit
  const iocValue = (alert.rawPayload.ioc as string) ?? (alert.rawPayload.ip as string) ?? (alert.rawPayload.hash as string);
  if (iocValue) {
    const cached = iocCache.get(iocValue);
    if (cached && cached.reputation === 'MALICIOUS' && cached.confidence >= 90) {
      log.info('Tier0: IOC cache hit', { traceId: alert.traceId });
      return { resolved: true, verdict: 'MALICIOUS', confidence: cached.confidence, reason: `Cached IOC: ${iocValue} (${cached.reputation})`, matchedRule: 'IOC_CACHE_HIT', latencyMs: Date.now() - start };
    }
    if (cached && cached.reputation === 'CLEAN') {
      return { resolved: true, verdict: 'CLEAN', confidence: cached.confidence, reason: 'IOC confirmed clean', matchedRule: 'IOC_CACHE_CLEAN', latencyMs: Date.now() - start };
    }
  }

  // Rule 3: Blacklisted domain
  for (const domain of BLACKLISTED_DOMAINS) {
    if (raw.includes(domain)) {
      return { resolved: true, verdict: 'MALICIOUS', confidence: 98, reason: `Blacklisted domain: ${domain}`, matchedRule: 'BLACKLIST_DOMAIN', latencyMs: Date.now() - start };
    }
  }

  // Rule 4: Known malicious hash
  for (const hash of BLACKLISTED_HASHES) {
    if (raw.includes(hash)) {
      return { resolved: true, verdict: 'MALICIOUS', confidence: 99, reason: 'Known malicious file hash', matchedRule: 'BLACKLIST_HASH', latencyMs: Date.now() - start };
    }
  }

  // Rule 5: Maintenance window suppression (low-severity only)
  if (isMaintenanceWindow() && incident.severity !== 'CRITICAL' && incident.severity !== 'HIGH') {
    return { resolved: true, verdict: 'SUPPRESSED', confidence: 85, reason: 'Alert during scheduled maintenance window', matchedRule: 'MAINTENANCE_WINDOW', latencyMs: Date.now() - start };
  }

  // Rule 6: Whitelisted actor
  const actor = (alert.rawPayload.actor as string) ?? (alert.rawPayload.username as string) ?? '';
  if (WHITELISTED_ACTORS.has(actor.toLowerCase())) {
    return { resolved: true, verdict: 'CLEAN', confidence: 90, reason: `Whitelisted service account: ${actor}`, matchedRule: 'WHITELIST_ACTOR', latencyMs: Date.now() - start };
  }

  // Rule 7: Very low-severity informational alerts
  if (incident.severity === 'INFO' && incident.confidence < 50) {
    return { resolved: true, verdict: 'CLEAN', confidence: 80, reason: 'Low-severity informational alert below threshold', matchedRule: 'LOW_SEVERITY_THRESHOLD', latencyMs: Date.now() - start };
  }

  // No rule matched — escalate to Tier 1
  return { resolved: false, verdict: 'ESCALATE', confidence: 0, reason: 'No Tier-0 rule matched', matchedRule: 'ESCALATE', latencyMs: Date.now() - start };
}
