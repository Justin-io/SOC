import React, { useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  ShieldAlert,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  FileCode,
  Terminal,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  Lock,
} from 'lucide-react';

import { Incident, AgentMetrics, EvidenceItem, DecisionIntelligence, AgentRole } from '../../types/soc';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface IncidentRoomViewProps {
  incident: Incident;
  allIncidents: Incident[];
  onSelectIncident: (id: string) => void;
  agents: AgentMetrics[];
  evidenceList: EvidenceItem[];
  decision: DecisionIntelligence;
  onApproveDecision: (action: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'ESCALATED', notes?: string) => void;
  onRunAIInvestigation: (incident: Incident) => Promise<void>;
  isAIInvestigating: boolean;
  aiAnalysisOutput?: string;
}

// Custom Agent Node for React Flow
const AgentNodeComponent: React.FC<NodeProps> = ({ data }) => {
  const agent = data.agent as AgentMetrics;
  const isExecuting = agent.status === 'ANALYZING' || agent.status === 'EXECUTING';

  return (
    <div
      className={`bg-white border rounded-md p-3 shadow-sm min-w-[200px] font-sans transition-all ${
        isExecuting
          ? 'border-blue-500 ring-2 ring-blue-100 animate-pulse'
          : 'border-[#E5E5E5]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#111111]" />

      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <Bot size={14} className={isExecuting ? 'text-blue-600' : 'text-[#737373]'} />
          <span className="font-bold text-xs text-[#111111]">{agent.role}</span>
        </div>
        <span
          className={`w-2 h-2 rounded-full ${
            agent.status === 'IDLE'
              ? 'bg-emerald-500'
              : agent.status === 'DEGRADED'
              ? 'bg-amber-500'
              : 'bg-blue-500 animate-ping'
          }`}
        />
      </div>

      <div className="space-y-1 font-mono text-[10px]">
        <div className="flex justify-between text-[#525252]">
          <span>Status:</span>
          <span className="font-semibold text-[#111111]">{agent.status}</span>
        </div>
        <div className="flex justify-between text-[#525252]">
          <span>Latency:</span>
          <span>{agent.latencyMs}ms</span>
        </div>
        <div className="flex justify-between text-[#525252]">
          <span>Confidence:</span>
          <span className="font-bold text-emerald-700">{agent.avgConfidence}%</span>
        </div>
        <div className="flex justify-between text-[#525252]">
          <span>Model:</span>
          <span className="truncate max-w-[100px] text-[#737373]">{agent.model}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-[#111111]" />
    </div>
  );
};

const nodeTypes = {
  agentNode: AgentNodeComponent,
};

export const IncidentRoomView: React.FC<IncidentRoomViewProps> = ({
  incident,
  allIncidents,
  onSelectIncident,
  agents,
  evidenceList,
  decision,
  onApproveDecision,
  onRunAIInvestigation,
  isAIInvestigating,
  aiAnalysisOutput,
}) => {
  const [activeBottomTab, setActiveBottomTab] = useState<'LOGS' | 'EVIDENCE' | 'TOOLS' | 'NETWORK' | 'AI'>('EVIDENCE');
  const [hoveredEdgeData, setHoveredEdgeData] = useState<{
    weight: number;
    confidence: number;
    tool: string;
    mitre: string;
    ratio: number;
  } | null>(null);

  // Generate React Flow nodes and edges based on 10 AI Agents
  const initialNodes: Node[] = useMemo(() => {
    const roles: AgentRole[] = [
      'COORDINATOR',
      'THREAT_INTEL',
      'MALWARE',
      'CLOUD',
      'INCIDENT_RESPONSE',
      'COMPLIANCE',
      'EDGE',
      'DECEPTION',
      'HUMAN',
      'FUSION_ENGINE',
    ];

    return roles.map((role, idx) => {
      const agent = agents.find((a) => a.role === role) || agents[0];
      const col = idx % 3;
      const row = Math.floor(idx / 3);

      return {
        id: role,
        type: 'agentNode',
        position: { x: col * 260 + 50, y: row * 160 + 40 },
        data: { agent },
      };
    });
  }, [agents]);

  const initialEdges: Edge[] = useMemo(() => {
    return [
      {
        id: 'e-intel-coord',
        source: 'THREAT_INTEL',
        target: 'COORDINATOR',
        animated: true,
        style: { strokeWidth: 3, stroke: '#2563EB' },
      },
      {
        id: 'e-malware-coord',
        source: 'MALWARE',
        target: 'COORDINATOR',
        animated: true,
        style: { strokeWidth: 4, stroke: '#DC2626' },
      },
      {
        id: 'e-cloud-coord',
        source: 'CLOUD',
        target: 'COORDINATOR',
        animated: true,
        style: { strokeWidth: 2, stroke: '#F59E0B' },
      },
      {
        id: 'e-coord-fusion',
        source: 'COORDINATOR',
        target: 'FUSION_ENGINE',
        animated: true,
        style: { strokeWidth: 5, stroke: '#111111' },
      },
      {
        id: 'e-edge-fusion',
        source: 'EDGE',
        target: 'FUSION_ENGINE',
        animated: true,
        style: { strokeWidth: 2, stroke: '#2563EB' },
      },
      {
        id: 'e-deception-fusion',
        source: 'DECEPTION',
        target: 'FUSION_ENGINE',
        animated: true,
        style: { strokeWidth: 3, stroke: '#16A34A' },
      },
      {
        id: 'e-fusion-ir',
        source: 'FUSION_ENGINE',
        target: 'INCIDENT_RESPONSE',
        animated: true,
        style: { strokeWidth: 4, stroke: '#DC2626' },
      },
      {
        id: 'e-fusion-human',
        source: 'FUSION_ENGINE',
        target: 'HUMAN',
        animated: true,
        style: { strokeWidth: 3, stroke: '#111111' },
      },
    ];
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto font-sans">
      {/* Top Selector & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#737373]">INCIDENT ROOM</span>
            <Badge severity={incident.severity} />
            <Badge status={incident.status} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111] mt-1">
            {incident.id}: {incident.title}
          </h1>
          <p className="text-xs text-[#525252] font-mono mt-0.5">
            Asset: <span className="font-bold text-[#111111]">{incident.asset.hostname}</span> ({incident.asset.ip}) | MITRE: {incident.mitreTechnique.id} ({incident.mitreTechnique.name})
          </p>
        </div>

        {/* Incident Switcher Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-[#737373]">Switch Active Incident:</label>
          <select
            value={incident.id}
            onChange={(e) => onSelectIncident(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded px-3 py-1.5 text-xs font-mono text-[#111111] focus:outline-none"
          >
            {allIncidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} — [{inc.severity}] {inc.title.slice(0, 40)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-Column Centerpiece Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Evidence Timeline (3 Cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h2 className="text-xs font-bold font-mono text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-[#737373]" />
              <span>Evidence Travel Timeline</span>
            </h2>
            <span className="text-[10px] font-mono text-[#737373]">({evidenceList.length} Items)</span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {evidenceList.map((evd) => (
              <Card
                key={evd.id}
                className="p-3 text-xs space-y-2 border-[#E5E5E5] hover:border-[#111111] transition-colors"
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="font-bold text-[#111111]">{evd.id}</span>
                  <span className="text-[#737373]">{evd.timestamp.slice(11, 19)}</span>
                </div>

                <div className="font-semibold text-[#111111] text-[11px] leading-tight">
                  {evd.source}
                </div>

                <p className="text-[11px] text-[#525252] font-mono leading-relaxed bg-[#FAFAFA] p-2 rounded border border-[#E5E5E5]">
                  {evd.rawContent}
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                    Agent: {evd.flaggedByAgent}
                  </span>
                  <span className="font-bold text-[#111111]">
                    Weight: {evd.weight}/10
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Center Column: Interactive React Flow Graph (6 Cols) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h2 className="text-xs font-bold font-mono text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-[#737373]" />
              <span>Interactive Agent Topology Graph</span>
            </h2>
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              React Flow Live Engine
            </span>
          </div>

          <div className="h-[640px] bg-[#FAFAFA] border border-[#E5E5E5] rounded-md overflow-hidden relative">
            <ReactFlow
              nodes={initialNodes}
              edges={initialEdges}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-right"
            >
              <Background color="#E5E5E5" gap={20} />
              <Controls />
            </ReactFlow>

            {/* Hover Edge Overlay details */}
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs border border-[#E5E5E5] p-2.5 rounded shadow-xs font-mono text-[10px] space-y-1">
              <div className="font-bold text-[#111111] border-b border-[#E5E5E5] pb-1">
                EVIDENCE FLOW DYNAMICS
              </div>
              <div className="flex justify-between gap-4 text-[#525252]">
                <span>Evidence Weight:</span>
                <span className="font-bold text-[#111111]">8.8 / 10</span>
              </div>
              <div className="flex justify-between gap-4 text-[#525252]">
                <span>Confidence:</span>
                <span className="font-bold text-emerald-700">96.4%</span>
              </div>
              <div className="flex justify-between gap-4 text-[#525252]">
                <span>Likelihood Ratio:</span>
                <span className="font-bold text-blue-700">18.4x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Decision Intelligence & Human Approval Panel (3 Cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h2 className="text-xs font-bold font-mono text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-red-600" />
              <span>Decision Intelligence</span>
            </h2>
            <span className="text-[10px] font-mono text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
              PENDING SLA
            </span>
          </div>

          <Card className="space-y-3 font-mono text-xs">
            {/* Probability & Risk */}
            <div className="grid grid-cols-2 gap-2 bg-[#FAFAFA] p-2.5 rounded border border-[#E5E5E5]">
              <div>
                <div className="text-[10px] text-[#737373]">FINAL PROBABILITY</div>
                <div className="text-xl font-bold text-red-600">
                  {decision.finalProbability}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#737373]">DISSENT LEVEL</div>
                <div className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-1">
                  <span>{decision.dissentLevel}</span>
                  <span className="text-[10px] text-[#737373]">({decision.dissentAgents.length} Agent)</span>
                </div>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="space-y-1">
              <div className="text-[10px] text-[#737373] uppercase font-bold">
                RECOMMENDED CONTAINMENT ACTION
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed font-sans font-medium">
                {decision.recommendedAction}
              </div>
            </div>

            {/* Counterfactual Explanation */}
            <div className="space-y-1">
              <div className="text-[10px] text-[#737373] uppercase font-bold">
                COUNTERFACTUAL EXPLANATION
              </div>
              <p className="text-[11px] text-[#525252] leading-relaxed font-sans bg-[#F4F4F5] p-2 rounded border border-[#E5E5E5]">
                {decision.counterfactualExplanation}
              </p>
            </div>

            {/* Business Impact */}
            <div className="space-y-1 text-[11px]">
              <div className="text-[10px] text-[#737373] uppercase font-bold">
                BUSINESS IMPACT ASSESSMENT
              </div>
              <p className="text-[#525252] font-sans">{decision.businessImpact}</p>
            </div>

            {/* Live Gemini AI Analysis Button */}
            <div className="pt-2 border-t border-[#E5E5E5]">
              <Button
                variant="primary"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
                disabled={isAIInvestigating}
                onClick={() => onRunAIInvestigation(incident)}
              >
                <Sparkles size={14} className="text-amber-300" />
                <span>
                  {isAIInvestigating
                    ? 'Synthesizing with Gemini 3.6 Flash...'
                    : 'Run Server AI Investigation'}
                </span>
              </Button>
            </div>

            {/* Human Approval Controls */}
            <div className="pt-3 border-t border-[#E5E5E5] space-y-2">
              <div className="text-[10px] text-[#737373] uppercase font-bold">
                HUMAN OPERATOR APPROVAL
              </div>
              {decision.approvalStatus === 'PENDING' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onApproveDecision('APPROVED', 'Human lead verified Kerberoasting evidence.')}
                  >
                    <CheckCircle2 size={13} className="mr-1 text-emerald-400" />
                    <span>Approve</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onApproveDecision('REJECTED', 'Dismissed as authorized maintenance.')}
                  >
                    <XCircle size={13} className="mr-1" />
                    <span>Reject</span>
                  </Button>
                </div>
              ) : (
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold text-center">
                  Action Status: {decision.approvalStatus}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Drawer Tabs: Logs, Evidence, Tool Execution, Network, AI Output */}
      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        <div className="flex items-center gap-1 border-b border-[#E5E5E5] bg-[#FAFAFA] px-3 font-mono text-xs">
          <button
            onClick={() => setActiveBottomTab('EVIDENCE')}
            className={`px-3 py-2 border-b-2 font-medium transition-colors ${
              activeBottomTab === 'EVIDENCE'
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-[#737373] hover:text-[#111111]'
            }`}
          >
            Raw Evidence Items ({evidenceList.length})
          </button>
          <button
            onClick={() => setActiveBottomTab('LOGS')}
            className={`px-3 py-2 border-b-2 font-medium transition-colors ${
              activeBottomTab === 'LOGS'
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-[#737373] hover:text-[#111111]'
            }`}
          >
            Agent Stream Logs
          </button>
          <button
            onClick={() => setActiveBottomTab('TOOLS')}
            className={`px-3 py-2 border-b-2 font-medium transition-colors ${
              activeBottomTab === 'TOOLS'
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-[#737373] hover:text-[#111111]'
            }`}
          >
            Tool Execution Trace
          </button>
          <button
            onClick={() => setActiveBottomTab('AI')}
            className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeBottomTab === 'AI'
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-[#737373] hover:text-[#111111]'
            }`}
          >
            <Sparkles size={13} className="text-amber-500" />
            <span>Gemini AI Synthesis</span>
          </button>
        </div>

        <div className="p-4 max-h-64 overflow-y-auto font-mono text-xs">
          {activeBottomTab === 'EVIDENCE' && (
            <div className="space-y-2">
              {evidenceList.map((item) => (
                <div key={item.id} className="p-2 border border-[#E5E5E5] rounded bg-[#FAFAFA] space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#111111]">
                    <span>[{item.type}] {item.source}</span>
                    <span>Confidence: {item.confidence}%</span>
                  </div>
                  <p className="text-[#525252]">{item.rawContent}</p>
                </div>
              ))}
            </div>
          )}

          {activeBottomTab === 'LOGS' && (
            <div className="bg-[#111111] text-emerald-400 p-3 rounded space-y-1 font-mono text-[11px]">
              <div>[05:41:00Z] COORDINATOR: Initializing evidence fusion for {incident.id}...</div>
              <div>[05:41:15Z] THREAT_INTEL: Cross-referencing IP 185.220.101.45 with VirusTotal API...</div>
              <div>[05:41:40Z] MALWARE: Memory inspection confirmed process read on lsass.exe PID 684.</div>
              <div>[05:42:05Z] FUSION_ENGINE: Conformal risk score rendered at {decision.finalProbability}%.</div>
            </div>
          )}

          {activeBottomTab === 'TOOLS' && (
            <div className="space-y-1.5">
              <div className="p-2 bg-[#FAFAFA] border rounded flex justify-between">
                <span>CrowdStrike Falcon API: `isolate_host(DC01-PROD-EAST)`</span>
                <span className="text-amber-600 font-bold">READY (Awaiting Approval)</span>
              </div>
              <div className="p-2 bg-[#FAFAFA] border rounded flex justify-between">
                <span>Active Directory PowerShell: `Reset-KrbtgtUserPassword`</span>
                <span className="text-zinc-600">STAGED</span>
              </div>
            </div>
          )}

          {activeBottomTab === 'AI' && (
            <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded whitespace-pre-wrap leading-relaxed text-[#111111]">
              {aiAnalysisOutput || 'Click "Run Server AI Investigation" above to trigger Gemini 3.6 Flash deep security synthesis for this incident.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
