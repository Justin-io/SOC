import React, { useState } from 'react';
import {
  Bot,
  Search,
  Activity,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
} from 'lucide-react';
import { AgentMetrics, AgentRole } from '../../types/soc';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface AgentObservabilityViewProps {
  agents: AgentMetrics[];
  onUpdateAgentModel: (role: AgentRole, model: string) => void;
}

export const AgentObservabilityView: React.FC<AgentObservabilityViewProps> = ({
  agents,
  onUpdateAgentModel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgentRole, setSelectedAgentRole] = useState<AgentRole | null>(null);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedAgent = agents.find((a) => a.role === selectedAgentRole) || null;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Agent Observatory & Execution Diagnostics
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Realtime Telemetry, Queue Depths & Model Performance across 10 Autonomous Agents
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-[#525252]">
          <Bot size={16} className="text-emerald-600" />
          <span className="font-bold text-[#111111]">{agents.length} AGENTS ACTIVE</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-md font-mono text-xs">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-2.5 text-[#737373]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search agents by role, model, or capability..."
            className="w-full bg-white border border-[#E5E5E5] rounded pl-9 pr-3 py-1.5 text-xs text-[#111111] focus:outline-none"
          />
        </div>
        <div className="text-[#737373] text-[11px]">
          Click any card to inspect live execution logs
        </div>
      </div>

      {/* Grid of Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <Card
            key={agent.role}
            onClick={() => setSelectedAgentRole(agent.role)}
            hoverable
            className={`space-y-3 font-mono text-xs ${
              selectedAgentRole === agent.role ? 'ring-2 ring-[#111111]' : ''
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#F4F4F5] border border-[#E5E5E5] flex items-center justify-center font-bold text-xs text-[#111111]">
                  <Bot size={15} />
                </div>
                <div>
                  <div className="font-bold text-[#111111] text-xs">{agent.role}</div>
                  <div className="text-[10px] text-[#737373]">{agent.name}</div>
                </div>
              </div>
              <Badge status={agent.status} />
            </div>

            {/* Description */}
            <p className="text-[11px] text-[#525252] font-sans leading-snug line-clamp-2">
              {agent.description}
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#FAFAFA] p-2.5 rounded border border-[#E5E5E5]">
              <div>
                <span className="text-[#737373] text-[10px]">MODEL:</span>
                <div className="font-bold text-[#111111] truncate">{agent.model}</div>
              </div>
              <div>
                <span className="text-[#737373] text-[10px]">HEALTH:</span>
                <div className="font-bold text-emerald-700">{agent.healthPercent}%</div>
              </div>
              <div>
                <span className="text-[#737373] text-[10px]">LATENCY:</span>
                <div className="font-bold text-[#111111]">{agent.latencyMs}ms</div>
              </div>
              <div>
                <span className="text-[#737373] text-[10px]">MEMORY:</span>
                <div className="font-bold text-[#111111]">{agent.memoryUsageMb} MB</div>
              </div>
            </div>

            {/* Extra Counters */}
            <div className="flex items-center justify-between text-[10px] text-[#737373] border-t border-[#E5E5E5] pt-2">
              <span>Reqs: <strong className="text-[#111111]">{agent.totalRequests}</strong></span>
              <span>Tools: <strong className="text-[#111111]">{agent.toolCalls}</strong></span>
              <span>Cache: <strong className="text-emerald-700">{agent.cacheHitRate}%</strong></span>
            </div>
          </Card>
        ))}
      </div>

      {/* Selected Agent Log & Configuration Drawer */}
      {selectedAgent && (
        <Card className="p-4 space-y-3 font-mono text-xs border-[#111111]">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-[#111111]" />
              <h3 className="font-bold text-sm text-[#111111]">
                Execution Diagnostic Log — {selectedAgent.name} ({selectedAgent.role})
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAgentRole(null)}>
              Close Log
            </Button>
          </div>

          <div className="bg-[#111111] text-emerald-400 p-3 rounded space-y-1 font-mono text-[11px] max-h-48 overflow-y-auto">
            <div>[{selectedAgent.lastExecution}] SYSTEM: Model route {selectedAgent.model} initialized.</div>
            <div>[{selectedAgent.lastExecution}] QUEUE: Processing 1 context task. Latency: {selectedAgent.latencyMs}ms.</div>
            <div>[{selectedAgent.lastExecution}] TOOL_CALL: Executed security analysis check. Reliability weight: {selectedAgent.reliabilityWeight}.</div>
            <div>[{selectedAgent.lastExecution}] SUCCESS: Confidence score rendered at {selectedAgent.avgConfidence}%.</div>
          </div>
        </Card>
      )}
    </div>
  );
};
