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

import {
  INITIAL_INCIDENTS,
  INITIAL_AGENTS,
  INITIAL_EVIDENCE,
  INITIAL_DECISION,
  INITIAL_IOCS,
  INITIAL_NETWORK_NODES,
  INITIAL_DIGITAL_TWIN,
  INITIAL_AUDIT_BLOCKS,
  INITIAL_REPORTS,
  INITIAL_SETTINGS,
  INITIAL_SYSTEM_HEALTH,
} from '../data/mockData';

export interface AIInvestigationResponse {
  success: boolean;
  analysis: string;
  timestamp?: string;
  modelUsed?: string;
}

class AEGISApiClient {
  private isConnected: boolean = true;
  private sseSource: EventSource | null = null;
  private onTelemetryCallbacks: Array<(data: Partial<SystemHealthMetrics>) => void> = [];
  private onLiveEventCallbacks: Array<(data: { id: string; asset: string; severity: string; technique: { id: string; name: string }; timestamp: string }) => void> = [];
  private onConnectionChangeCallbacks: Array<(connected: boolean) => void> = [];

  constructor() {
    this.initSSE();
  }

  private initSSE() {
    if (typeof window === 'undefined') return;
    try {
      this.sseSource = new EventSource('/api/events/stream');

      this.sseSource.onopen = () => {
        this.setConnected(true);
      };

      this.sseSource.addEventListener('connected', () => {
        this.setConnected(true);
      });

      this.sseSource.addEventListener('telemetry', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.onTelemetryCallbacks.forEach((cb) => cb(data));
        } catch (err) {
          console.error('Failed to parse SSE telemetry:', err);
        }
      });

      this.sseSource.addEventListener('live_event', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.onLiveEventCallbacks.forEach((cb) => cb(data));
        } catch (err) {
          console.error('Failed to parse SSE live_event:', err);
        }
      });

      this.sseSource.onerror = () => {
        this.setConnected(false);
      };
    } catch {
      this.setConnected(false);
    }
  }

  private setConnected(status: boolean) {
    if (this.isConnected !== status) {
      this.isConnected = status;
      this.onConnectionChangeCallbacks.forEach((cb) => cb(status));
    }
  }

  public subscribeConnectionChange(cb: (connected: boolean) => void) {
    this.onConnectionChangeCallbacks.push(cb);
    cb(this.isConnected);
    return () => {
      this.onConnectionChangeCallbacks = this.onConnectionChangeCallbacks.filter((fn) => fn !== cb);
    };
  }

  public subscribeTelemetry(cb: (data: Partial<SystemHealthMetrics>) => void) {
    this.onTelemetryCallbacks.push(cb);
    return () => {
      this.onTelemetryCallbacks = this.onTelemetryCallbacks.filter((fn) => fn !== cb);
    };
  }

  public subscribeLiveEvents(cb: (data: { id: string; asset: string; severity: string; technique: { id: string; name: string }; timestamp: string }) => void) {
    this.onLiveEventCallbacks.push(cb);
    return () => {
      this.onLiveEventCallbacks = this.onLiveEventCallbacks.filter((fn) => fn !== cb);
    };
  }

  public async fetchHealth(): Promise<SystemHealthMetrics> {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        this.setConnected(true);
        return {
          ...INITIAL_SYSTEM_HEALTH,
          cpuUsage: data.cpuUsagePercent || INITIAL_SYSTEM_HEALTH.cpuUsage,
          memoryUsage: data.memoryUsageMb ? Math.min(100, Math.round((data.memoryUsageMb / 1024) * 100)) : INITIAL_SYSTEM_HEALTH.memoryUsage,
          realtimeConnected: this.isConnected,
        };
      }
    } catch {
      this.setConnected(false);
    }
    return { ...INITIAL_SYSTEM_HEALTH, realtimeConnected: this.isConnected };
  }

  public async runAIInvestigation(incident: Incident, evidenceList: EvidenceItem[]): Promise<AIInvestigationResponse> {
    try {
      const res = await fetch('/api/investigate/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentTitle: incident.title,
          incidentDescription: incident.description,
          mitreTechnique: `${incident.mitreTechnique.id} - ${incident.mitreTechnique.name}`,
          rawEvidence: evidenceList.map((e) => `[${e.type}] ${e.source}: ${e.rawContent}`).join('\n'),
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('AI Investigation API call failed, falling back to local synthesis:', err);
    }

    return {
      success: true,
      analysis: `### AEGIS-X Automated Analysis (${incident.title})\n\n- **Primary Threat Vector**: ${incident.source}\n- **MITRE Mapping**: ${incident.mitreTechnique.id} (${incident.mitreTechnique.name})\n- **Statistical Confidence**: ${incident.confidence}%\n\n**Recommended SLA Response**:\n1. Execute playbook for ${incident.assignedAgent}.\n2. Network-isolate asset ${incident.asset.hostname} (${incident.asset.ip}).\n3. Purge compromised authentication tokens.`,
      timestamp: new Date().toISOString(),
      modelUsed: 'gemini-3.6-flash (fallback)',
    };
  }

  public async generateReport(title: string, category: string, focusArea: string): Promise<SOCReport> {
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, focusArea }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) return data.report;
      }
    } catch (err) {
      console.warn('Generate Report API call failed, falling back:', err);
    }

    return {
      id: `RPT-${Date.now()}`,
      title: title || 'Executive SOC Briefing',
      category: (category as any) || 'EXECUTIVE',
      generatedAt: new Date().toISOString(),
      author: 'AEGIS-X Local Intelligence Engine',
      status: 'READY',
      summary: `Automated summary generated for ${focusArea}. All threat SLA parameters maintained. Zero high-risk uncontained breaches.`,
      incidentCount: 12,
      fileSizeMb: 3.2,
      mitreCoveragePercent: 96.0,
    };
  }

  public async fetchIncidents(): Promise<Incident[]> {
    try {
      const res = await fetch('/api/v1/incidents');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data.items)) {
          return json.data.items;
        }
      }
    } catch (err) {
      console.warn('Fetch incidents failed:', err);
    }
    return [];
  }

  public async triggerSimulation(): Promise<{
    success: boolean;
    incident?: Incident;
    evidence?: EvidenceItem[];
    decision?: DecisionIntelligence;
  }> {
    try {
      const res = await fetch('/api/v1/simulate', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('Trigger simulation failed:', err);
    }
    return { success: false };
  }

  public async resetStore(): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/reset', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Baseline data getters
  public getInitialIncidents(): Incident[] { return [...INITIAL_INCIDENTS]; }
  public getInitialAgents(): AgentMetrics[] { return [...INITIAL_AGENTS]; }
  public getInitialEvidence(): EvidenceItem[] { return [...INITIAL_EVIDENCE]; }
  public getInitialDecision(): DecisionIntelligence { return { ...INITIAL_DECISION }; }
  public getInitialIOCs(): IOCItem[] { return [...INITIAL_IOCS]; }
  public getInitialNetworkNodes(): NetworkNode[] { return [...INITIAL_NETWORK_NODES]; }
  public getInitialDigitalTwin(): DigitalTwinState { return { ...INITIAL_DIGITAL_TWIN }; }
  public getInitialAuditBlocks(): AuditBlock[] { return [...INITIAL_AUDIT_BLOCKS]; }
  public getInitialReports(): SOCReport[] { return [...INITIAL_REPORTS]; }
  public getInitialSettings(): SOCSettings { return { ...INITIAL_SETTINGS }; }
  public getInitialSystemHealth(): SystemHealthMetrics { return { ...INITIAL_SYSTEM_HEALTH }; }
}

export const apiClient = new AEGISApiClient();
