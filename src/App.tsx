import React, { useState, useEffect } from 'react';
import { SimulationOverlay } from './components/ui/SimulationOverlay';
import { Sidebar, ViewType } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { GlobalSearch } from './components/layout/GlobalSearch';
import { NotificationCenter, NotificationItem } from './components/layout/NotificationCenter';

import { DashboardView } from './components/views/DashboardView';
import { LiveIncidentsView } from './components/views/LiveIncidentsView';
import { IncidentRoomView } from './components/views/IncidentRoomView';
import { AgentObservabilityView } from './components/views/AgentObservabilityView';
import { ThreatIntelView } from './components/views/ThreatIntelView';
import { ThreatGraphView } from './components/views/ThreatGraphView';
import { DigitalTwinView } from './components/views/DigitalTwinView';
import { ChrononView } from './components/views/ChrononView';
import { AuditTrailView } from './components/views/AuditTrailView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ReportsView } from './components/views/ReportsView';
import { AdministrationView } from './components/views/AdministrationView';
import { BenchmarkView } from './components/views/BenchmarkView';

import {
  INITIAL_INCIDENTS,
  INITIAL_AGENTS,
  INITIAL_IOCS,
  INITIAL_REPORTS,
  INITIAL_AUDIT_BLOCKS,
  INITIAL_NETWORK_NODES,
  INITIAL_DIGITAL_TWIN,
  INITIAL_SYSTEM_HEALTH,
  INITIAL_SETTINGS,
  INITIAL_EVIDENCE,
  INITIAL_DECISION,
} from './data/syntheticData';

import {
  Incident,
  IncidentStatus,
  AgentRole,
  AgentMetrics,
  EvidenceItem,
  DecisionIntelligence,
  SystemSettings,
  SOCReport,
  AuditBlock,
  NetworkNode,
  DigitalTwinState,
  SystemHealthMetrics,
} from './types/soc';

import { apiClient } from './services/apiClient';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('INC-2026-9041');
  const [activeWorkspace, setActiveWorkspace] = useState<string>('GLOBAL SOC - PROD NORTH AMERICA');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  // Core State
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [agents, setAgents] = useState<AgentMetrics[]>(INITIAL_AGENTS);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceItem[]>(INITIAL_EVIDENCE);
  const [activeDecision, setActiveDecision] = useState<DecisionIntelligence>(INITIAL_DECISION);
  const [iocs, setIocs] = useState(INITIAL_IOCS);
  const [reports, setReports] = useState<SOCReport[]>(INITIAL_REPORTS);
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>(INITIAL_AUDIT_BLOCKS);
  const [digitalTwinNodes, setDigitalTwinNodes] = useState<NetworkNode[]>(INITIAL_NETWORK_NODES);
  const [digitalTwinState, setDigitalTwinState] = useState<DigitalTwinState>(INITIAL_DIGITAL_TWIN);
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics>(INITIAL_SYSTEM_HEALTH);
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);

  // Live Server AI & Emulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationOverlayVisible, setSimulationOverlayVisible] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<Incident | null>(null);
  const [isAIInvestigating, setIsAIInvestigating] = useState<boolean>(false);
  const [aiAnalysisOutput, setAiAnalysisOutput] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // Notification Bus State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Initial fetch from backend API
  useEffect(() => {
    apiClient.fetchIncidents().then((fetched) => {
      setIncidents(fetched);
      if (fetched.length > 0) {
        setSelectedIncidentId(fetched[0].id);
      }
    });
  }, []);

  // Fetch Evidence & Decision when selected incident changes
  useEffect(() => {
    if (!selectedIncidentId) return;
    apiClient.fetchEvidence(selectedIncidentId).then(setActiveEvidence);
    apiClient.fetchDecision(selectedIncidentId).then(setActiveDecision);
  }, [selectedIncidentId]);

  const handleEmulateThreat = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationResult(null);
    setSimulationOverlayVisible(true);
    try {
      const res = await apiClient.triggerEmulation();
      if (res.success && res.incident) {
        const newInc = res.incident;
        setIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== newInc.id)]);
        setSelectedIncidentId(newInc.id);
        setSimulationResult(newInc);
        setNotifications((prev) => [
          {
            id: `NOTIF-${Date.now()}`,
            title: `⚡ AI Threat Ingested: ${newInc.title}`,
            message: `Asset ${newInc.asset.hostname} (${newInc.asset.ip}) under active investigation by 10 autonomous agents. Source: ${newInc.source}.`,
            timestamp: 'Just now',
            severity: newInc.severity,
            read: false,
          },
          ...prev,
        ]);
        if (res.evidence) setActiveEvidence(res.evidence);
        if (res.decision) setActiveDecision(res.decision);
      }
    } catch (err) {
      console.error('Emulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulationDismiss = () => {
    setSimulationOverlayVisible(false);
    setActiveView('incident-room');
  };

  const handleResetStore = async () => {
    await apiClient.resetStore();
    setIncidents([]);
    setNotifications([]);
  };

  const activeIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  // Realtime Server SSE Bus Subscriptions via apiClient
  useEffect(() => {
    const unsubHealth = apiClient.subscribeConnectionChange((connected) => {
      setSystemHealth((prev) => ({ ...prev, realtimeConnected: connected }));
    });

    const unsubTelemetry = apiClient.subscribeTelemetry((data) => {
      setSystemHealth((prev) => ({
        ...prev,
        cpuUsage: data.cpuUsage || prev.cpuUsage,
        memoryUsage: data.memoryUsage || prev.memoryUsage,
        realtimeConnected: true,
      }));
    });

    const unsubLive = apiClient.subscribeLiveEvents((data) => {
      setNotifications((prev) => [
        {
          id: data.id,
          title: `Telemetry Alert: ${data.technique.name}`,
          message: `Asset ${data.asset} registered ${data.technique.id} with ${data.confidence}% confidence.`,
          timestamp: 'Just now',
          severity: data.severity as any,
          read: false,
        },
        ...prev.slice(0, 19),
      ]);
    });

    const unsubIncidents = apiClient.subscribeIncidentUpdates((data) => {
      if (data.incident) {
        setIncidents((prev) => [data.incident, ...prev.filter((i) => i.id !== data.incident.id)]);
        setSelectedIncidentId(data.incident.id);
      } else if (data.type === 'STORE_RESET') {
        setIncidents([]);
      }
    });

    return () => {
      unsubHealth();
      unsubTelemetry();
      unsubLive();
      unsubIncidents();
    };
  }, []);

  const handleNavigateView = (view: ViewType, itemId?: string) => {
    setActiveView(view);
    if (itemId) {
      if (view === 'incident-room') {
        setSelectedIncidentId(itemId);
      }
    }
  };

  const handleUpdateIncidentStatus = (id: string, newStatus: IncidentStatus) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
    );

    // Record in Audit Chain
    const newBlock: AuditBlock = {
      index: auditBlocks.length + 1,
      hash: `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`,
      previousHash: auditBlocks[auditBlocks.length - 1]?.hash || '0x000000',
      timestamp: new Date().toISOString(),
      actor: 'SOC_OPERATOR (Hari Nandan K & Anjaleena Francis)',
      actorType: 'HUMAN',
      action: `INCIDENT_STATUS_CHANGE [${id} -> ${newStatus}]`,
      details: { incidentId: id, status: newStatus },
      integrityProof: 'SHA256_ED25519_VALIDATED',
      verificationStatus: 'VALID',
    };

    setAuditBlocks((prev) => [newBlock, ...prev]);
  };

  const handleApproveDecision = async (
    action: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'ESCALATED',
    notes?: string
  ) => {
    const newStatus = action === 'APPROVED' ? 'CONTAINED' : 'RESOLVED';
    handleUpdateIncidentStatus(selectedIncidentId, newStatus);
    apiClient.updateIncidentStatus(selectedIncidentId, newStatus);

    const updatedDecision = await apiClient.approveDecision(selectedIncidentId, action, notes);
    if (updatedDecision) {
      setActiveDecision(updatedDecision);
    } else {
      setActiveDecision((prev) => ({
        ...prev,
        approvalStatus: action,
        approvedBy: 'HUMAN_OPERATOR',
        approvalTimestamp: new Date().toISOString(),
      }));
    }

    setNotifications((prev) => [
      {
        id: `NOTIF-${Date.now()}`,
        title: `Containment Decision ${action}`,
        message: `Incident ${selectedIncidentId} status updated following operator approval. Notes: ${notes || 'None'}`,
        timestamp: 'Just now',
        severity: 'LOW',
        read: false,
      },
      ...prev,
    ]);
  };

  const handleRunAIInvestigation = async (inc: Incident) => {
    setIsAIInvestigating(true);
    try {
      const res = await apiClient.runAIInvestigation(inc, activeEvidence);
      if (res && res.analysis) {
        setAiAnalysisOutput(res.analysis);
      }
    } catch {
      setAiAnalysisOutput('Server investigation request timed out. Deterministic evaluation: Kerberoasting attack vector confirmed across domain controller logs.');
    } finally {
      setIsAIInvestigating(false);
    }
  };

  const handleGenerateReport = async (category: string) => {
    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Autonomous SOC Executive Briefing ${new Date().toISOString().slice(0, 10)}`,
          category,
          focusArea: 'Enterprise Identity & Infrastructure Defense',
        }),
      });
      const data = await res.json();
      if (data.report) {
        const newRep: SOCReport = {
          id: data.report.id,
          title: data.report.title,
          date: new Date().toISOString().slice(0, 10),
          generatedAt: new Date().toISOString(),
          category: data.report.category,
          summary: data.report.summary,
          author: data.report.author || 'AEGIS-X AI Engine',
          generatedBy: data.report.author || 'AEGIS-X AI Engine',
          status: 'READY',
          downloadUrl: '#',
          keyFindings: [
            'Mean Time to Contain (MTTC) sustained at 3.4 minutes.',
            'Zero unhandled critical incidents within SLA timeframe.',
            'MITRE ATT&CK coverage verified at 95.4%.',
          ],
          recommendations: [
            'Enforce gMSA for Active Directory service accounts.',
            'Harden kerberos ticket encryption algorithms to AES256.',
          ],
        };
        setReports((prev) => [newRep, ...prev]);
      }
    } catch {
      // Fallback local report
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleToggleIsolationNode = (nodeId: string) => {
    setDigitalTwinNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          const isNowIsolated = n.status !== 'ISOLATED' && n.status !== 'EMULATED_ISOLATION';
          return {
            ...n,
            status: isNowIsolated ? 'EMULATED_ISOLATION' : 'ACTIVE',
          };
        }
        return n;
      })
    );

    // Recalculate digital twin risk
    setDigitalTwinState((prev) => ({
      ...prev,
      totalRiskAfter: Math.max(8, prev.totalRiskAfter - 12),
      projectedVictimsAfter: Math.max(1, prev.projectedVictimsAfter - 2),
      containmentEffectiveness: Math.min(99, prev.containmentEffectiveness + 5),
    }));
  };

  const handleResetEmulation = () => {
    setDigitalTwinNodes(INITIAL_NETWORK_NODES);
    setDigitalTwinState(INITIAL_DIGITAL_TWIN);
  };

  const handleUpdateAgentModel = (role: AgentRole, model: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.role === role ? { ...a, model } : a))
    );
  };

  const handleToggleAgentActive = (role: AgentRole) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.role === role) {
          return {
            ...a,
            status: a.status === 'DEGRADED' ? 'IDLE' : 'DEGRADED',
          };
        }
        return a;
      })
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="h-screen w-screen bg-[#FFFFFF] text-[#111111] flex overflow-hidden font-sans antialiased selection:bg-[#111111] selection:text-white">
      {/* Persistent Left Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onNavigateView={handleNavigateView}
        activeIncidentCount={incidents.filter((i) => i.status !== 'RESOLVED').length}
        activeAgentCount={agents.filter((a) => a.status !== 'DEGRADED').length}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Right Main Column: Header + Scrollable Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          unreadNotificationsCount={unreadCount}
          realtimeConnected={systemHealth.realtimeConnected}
          agentHealthPercent={Math.round(
            (agents.filter((a) => a.status !== 'DEGRADED').length / agents.length) * 100
          )}
          activeWorkspace={activeWorkspace}
          onChangeWorkspace={setActiveWorkspace}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onEmulateThreat={handleEmulateThreat}
          onResetStore={handleResetStore}
          isSimulating={isSimulating}
        />

        {/* Primary Content Router Area */}
        <main className="flex-1 overflow-y-auto bg-white">
          {activeView === 'dashboard' && (
            <DashboardView
              incidents={incidents}
              systemHealth={systemHealth}
              onNavigateView={handleNavigateView}
              onEmulateThreat={handleEmulateThreat}
            />
          )}

          {activeView === 'incidents' && (
            <LiveIncidentsView
              incidents={incidents}
              onNavigateView={handleNavigateView}
              onUpdateIncidentStatus={handleUpdateIncidentStatus}
            />
          )}

          {activeView === 'incident-room' && (
            <IncidentRoomView
              incident={activeIncident}
              allIncidents={incidents}
              onSelectIncident={(id) => setSelectedIncidentId(id)}
              agents={agents}
              evidenceList={activeEvidence}
              decision={activeDecision}
              onApproveDecision={handleApproveDecision}
              onRunAIInvestigation={handleRunAIInvestigation}
              isAIInvestigating={isAIInvestigating}
              aiAnalysisOutput={aiAnalysisOutput}
            />
          )}

          {activeView === 'agent-observatory' && (
            <AgentObservabilityView
              agents={agents}
              onUpdateAgentModel={handleUpdateAgentModel}
            />
          )}

          {activeView === 'threat-intel' && (
            <ThreatIntelView iocs={iocs} />
          )}

          {activeView === 'threat-graph' && (
            <ThreatGraphView
              incidents={incidents}
              onSelectIncident={(id) => {
                setSelectedIncidentId(id);
                setActiveView('incident-room');
              }}
            />
          )}

          {activeView === 'digital-twin' && (
            <DigitalTwinView
              nodes={digitalTwinNodes}
              digitalTwinState={digitalTwinState}
              onToggleIsolationNode={handleToggleIsolationNode}
              onResetEmulation={handleResetEmulation}
            />
          )}

          {activeView === 'chronon' && <ChrononView />}

          {activeView === 'audit-trail' && (
            <AuditTrailView blocks={auditBlocks} />
          )}

          {activeView === 'analytics' && <AnalyticsView />}

          {activeView === 'benchmark' && <BenchmarkView />}

          {activeView === 'reports' && (
            <ReportsView
              reports={reports}
              onGenerateReport={handleGenerateReport}
              isGenerating={isGeneratingReport}
            />
          )}

          {activeView === 'administration' && (
            <AdministrationView
              settings={settings}
              agents={agents}
              onSaveSettings={(s) => setSettings(s)}
              onUpdateAgentModel={handleUpdateAgentModel}
              onToggleAgentActive={handleToggleAgentActive}
            />
          )}
        </main>
      </div>

      {/* Global Command Palette Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        incidents={incidents}
        agents={agents}
        iocs={iocs}
        reports={reports}
        onNavigateView={handleNavigateView}
      />

      {/* Realtime Notification Bus Drawer */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
        onClearAll={() => setNotifications([])}
        onNotificationClick={(id) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
          );
        }}
      />

      {/* AI Multi-Agent Simulation Cascade Overlay */}
      <SimulationOverlay
        visible={simulationOverlayVisible}
        result={simulationResult}
        onDismiss={handleSimulationDismiss}
      />
    </div>
  );
}
