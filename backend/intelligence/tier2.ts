/**
 * AEGIS-X Backend — Intelligence Tier 2
 * Lightweight cloud reasoning via Gemini Flash with tight token budget (2s timeout).
 * Falls back to structured heuristic analysis when unavailable.
 */

import { GoogleGenAI } from '@google/genai';
import type { AlertRecord } from '../core/types.js';
import { config, hasGeminiKey } from '../core/config.js';
import { circuitBreakers } from '../core/circuit-breaker.js';
import { getLogger } from '../core/logger.js';

const log = getLogger('intelligence:tier2');

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (!aiClient && hasGeminiKey()) {
    aiClient = new GoogleGenAI({
      apiKey: config.geminiApiKey!,
      httpOptions: { headers: { 'User-Agent': 'aegis-x-backend/1.0' } },
    });
  }
  return aiClient;
}

export interface Tier2Result {
  resolved: boolean;
  confidence: number;
  riskAssessment: string;
  recommendedAction: string;
  counterfactual: string;
  usedFallback: boolean;
  latencyMs: number;
}

const HEURISTIC_PATTERNS: Record<string, { risk: string; action: string; counterfactual: string }> = {
  'T1003': {
    risk: 'CRITICAL: Active credential dumping attack targeting LSASS. High probability of domain-wide compromise.',
    action: 'Isolate affected host immediately. Force krbtgt password reset. Revoke all active Kerberos tickets.',
    counterfactual: 'Without LSASS memory access evidence, risk would reduce to HIGH. The combination of TGS-REQ RC4 + memory dump confirms active extraction.',
  },
  'T1078': {
    risk: 'HIGH: Compromised cloud credentials enabling lateral movement and privilege escalation.',
    action: 'Revoke compromised IAM sessions. Rotate all access keys. Enable MFA enforcement on all roles.',
    counterfactual: 'If the source IP matched a known developer VPN range, risk would be LOW. The autonomous system origin elevates confidence.',
  },
  'T1530': {
    risk: 'CRITICAL: Active data exfiltration from cloud storage. Potential GDPR/CCPA regulatory breach.',
    action: 'Attach explicit IAM Deny policy. Enable S3 Block Public Access. Trigger Macie PII scan on affected buckets.',
    counterfactual: 'If data was non-PII configuration files, regulatory impact would be NONE. PII data classification confirms breach severity.',
  },
  'T1059': {
    risk: 'HIGH: Suspicious command interpreter execution. Possible initial access or lateral movement.',
    action: 'Isolate endpoint via EDR. Collect memory forensics. Reset user credentials. Apply AppLocker/WDAC policy.',
    counterfactual: 'If executed from approved admin workstation during business hours, alert could be maintenance activity.',
  },
  'T1611': {
    risk: 'HIGH: Container escape attempt. Potential host compromise affecting adjacent workloads.',
    action: 'Cordon & drain affected pod. Revoke cluster-admin ServiceAccount. Apply strict NetworkPolicy egress controls.',
    counterfactual: 'Without privileged container flag, escape vector would be significantly harder to execute.',
  },
};

function getHeuristicAnalysis(mitreId: string): { risk: string; action: string; counterfactual: string } {
  const base = mitreId.split('.')[0];
  return HEURISTIC_PATTERNS[base] ?? {
    risk: 'MEDIUM: Unclassified security event requiring investigation.',
    action: 'Investigate alert context. Collect forensic artifacts. Escalate to full investigation if confirmed.',
    counterfactual: 'Additional context required to determine counterfactual impact.',
  };
}

export async function runTier2(alert: AlertRecord): Promise<Tier2Result> {
  const start = Date.now();
  const incident = alert.incident;
  const ai = getAI();

  if (!ai || circuitBreakers.gemini.isOpen) {
    const heuristic = getHeuristicAnalysis(incident.mitreTechnique.id);
    return {
      resolved: false,
      confidence: 72,
      riskAssessment: heuristic.risk,
      recommendedAction: heuristic.action,
      counterfactual: heuristic.counterfactual,
      usedFallback: true,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const prompt = `You are AEGIS-X Tier-2 Security Analyzer. Respond in JSON only.
Analyze: Incident "${incident.title}", MITRE: ${incident.mitreTechnique.id} (${incident.mitreTechnique.name}), Severity: ${incident.severity}, Asset: ${incident.asset.hostname} (${incident.asset.type}).
Respond with exactly: {"confidence":0-100,"riskAssessment":"one sentence","recommendedAction":"one sentence","counterfactual":"one sentence","resolved":true|false}`;

    const response = await circuitBreakers.gemini.execute(() =>
      ai.models.generateContent({
        model: config.geminiModelFast,
        contents: prompt,
        config: { temperature: 0.1, maxOutputTokens: 200 },
      })
    );

    const text = response.text?.trim() ?? '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        resolved: Boolean(parsed.resolved),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 70)),
        riskAssessment: String(parsed.riskAssessment || ''),
        recommendedAction: String(parsed.recommendedAction || ''),
        counterfactual: String(parsed.counterfactual || ''),
        usedFallback: false,
        latencyMs: Date.now() - start,
      };
    }
  } catch (err) {
    log.warn('Tier2 Gemini call failed, using heuristic fallback', { meta: { error: String(err) } });
  }

  const heuristic = getHeuristicAnalysis(incident.mitreTechnique.id);
  return {
    resolved: false,
    confidence: 72,
    riskAssessment: heuristic.risk,
    recommendedAction: heuristic.action,
    counterfactual: heuristic.counterfactual,
    usedFallback: true,
    latencyMs: Date.now() - start,
  };
}
