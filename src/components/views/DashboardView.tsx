import React from 'react';
import {
  ShieldAlert,
  Clock,
  Zap,
  Activity,
  Server,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Bot,
} from 'lucide-react';
import { Incident, SystemHealthMetrics } from '../../types/soc';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ViewType } from '../layout/Sidebar';

interface DashboardViewProps {
  incidents: Incident[];
  systemHealth: SystemHealthMetrics;
  onNavigateView: (view: ViewType, incidentId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  incidents,
  systemHealth,
  onNavigateView,
}) => {
  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'FALSE_POSITIVE');
  const criticalIncidents = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED');

  const avgInvestigationTime = '42s';
  const avgContainmentTime = '3.4m';

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Top Header Label */}
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Mission Control Operational Dashboard
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Autonomous AI Security Operations Center — Live System Telemetry
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-[#525252]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>AUTONOMOUS MODE: ENABLED</span>
        </div>
      </div>

      {/* 6 Top Operational Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] text-xs font-mono">
            <span>ACTIVE INCIDENTS</span>
            <ShieldAlert size={14} className="text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-[#111111]">
              {activeIncidents.length}
            </span>
            <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
              Live
            </span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] text-xs font-mono">
            <span>CRITICAL INCIDENTS</span>
            <AlertCircle size={14} className="text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-red-600">
              {criticalIncidents.length}
            </span>
            <span className="text-[10px] font-mono text-red-700 bg-red-50 px-1 py-0.5 rounded border border-red-200">
              SLA Critical
            </span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] text-xs font-mono">
            <span>AVG MTTD (DETECT)</span>
            <Clock size={14} className="text-[#737373]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-[#111111]">
              {avgInvestigationTime}
            </span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
              -12% vs Q2
            </span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] text-xs font-mono">
            <span>AVG MTTR (CONTAIN)</span>
            <Zap size={14} className="text-[#737373]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-[#111111]">
              {avgContainmentTime}
            </span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
              99.4% SLA
            </span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] text-xs font-mono">
            <span>SYSTEM LATENCY</span>
            <Activity size={14} className="text-[#737373]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-[#111111]">
              110ms
            </span>
            <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">
              Nominal
            </span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] text-xs font-mono">
            <span>AGENT HEALTH</span>
            <Bot size={14} className="text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-600">
              {systemHealth.agentAvailability}%
            </span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
              10/10 Active
            </span>
          </div>
        </Card>
      </div>

      {/* Main Grid: Left Activity Stream + Right System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Live Activity Stream (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#111111]">Realtime Security Event Stream</h2>
              <span className="text-[11px] font-mono text-[#737373]">({incidents.length} Events Logged)</span>
            </div>
            <button
              onClick={() => onNavigateView('incidents')}
              className="text-xs font-mono text-[#111111] hover:underline flex items-center gap-1"
            >
              <span>View All Live Incidents</span>
              <ExternalLink size={12} />
            </button>
          </div>

          <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5] font-mono text-[#737373] uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Incident ID</th>
                    <th className="py-2.5 px-4 font-semibold">Severity</th>
                    <th className="py-2.5 px-4 font-semibold">Target Asset</th>
                    <th className="py-2.5 px-4 font-semibold">Source & Detector</th>
                    <th className="py-2.5 px-4 font-semibold">MITRE Technique</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5] font-mono">
                  {incidents.map((inc) => (
                    <tr
                      key={inc.id}
                      onClick={() => onNavigateView('incident-room', inc.id)}
                      className="hover:bg-[#FAFAFA] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-bold text-[#111111] group-hover:underline">
                        {inc.id}
                      </td>
                      <td className="py-3 px-4">
                        <Badge severity={inc.severity} />
                      </td>
                      <td className="py-3 px-4 text-[#111111]">
                        <div className="font-semibold">{inc.asset.hostname}</div>
                        <div className="text-[10px] text-[#737373]">{inc.asset.ip}</div>
                      </td>
                      <td className="py-3 px-4 text-[#525252] truncate max-w-[180px]">
                        {inc.source}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-[#F4F4F5] border border-[#E5E5E5] px-1.5 py-0.5 rounded text-[10px] font-mono text-[#111111]">
                          {inc.mitreTechnique.id}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={inc.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#111111]">
                        {inc.confidence}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Infrastructure & API System Health Panel (1 Col) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#111111]">System Infrastructure Health</h2>

          <Card className="space-y-4 font-mono text-xs">
            {/* API Status */}
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5">
              <span className="text-[#737373] flex items-center gap-1.5">
                <Server size={14} />
                <span>API Gateway</span>
              </span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>{systemHealth.apiStatus}</span>
              </span>
            </div>

            {/* Agent Availability */}
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2.5">
              <span className="text-[#737373] flex items-center gap-1.5">
                <Bot size={14} />
                <span>Agent Cluster</span>
              </span>
              <span className="text-[#111111] font-semibold">
                {systemHealth.agentAvailability}%
              </span>
            </div>

            {/* CPU Meter */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#737373] flex items-center gap-1">
                  <Cpu size={12} />
                  <span>CPU Cluster Load</span>
                </span>
                <span className="font-semibold text-[#111111]">{systemHealth.cpuUsage}%</span>
              </div>
              <div className="w-full bg-[#F4F4F5] h-1.5 rounded overflow-hidden">
                <div
                  className="bg-[#111111] h-full transition-all duration-300"
                  style={{ width: `${systemHealth.cpuUsage}%` }}
                />
              </div>
            </div>

            {/* Memory Usage */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#737373] flex items-center gap-1">
                  <Layers size={12} />
                  <span>Memory Usage</span>
                </span>
                <span className="font-semibold text-[#111111]">{systemHealth.memoryUsage}%</span>
              </div>
              <div className="w-full bg-[#F4F4F5] h-1.5 rounded overflow-hidden">
                <div
                  className="bg-[#111111] h-full transition-all duration-300"
                  style={{ width: `${systemHealth.memoryUsage}%` }}
                />
              </div>
            </div>

            {/* LLM Queue Depth */}
            <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-2.5">
              <span className="text-[#737373]">LLM Inference Queue</span>
              <span className="font-semibold text-[#111111] px-2 py-0.5 rounded bg-[#F4F4F5] border border-[#E5E5E5]">
                {systemHealth.llmQueueDepth} pending
              </span>
            </div>

            {/* Realtime Stream Connection */}
            <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-2.5">
              <span className="text-[#737373]">Realtime SSE Bus</span>
              <span className={`font-semibold ${systemHealth.realtimeConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {systemHealth.realtimeConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </Card>

          {/* Subsystem Integrations Status */}
          <Card className="space-y-2 font-mono text-xs">
            <div className="text-[11px] font-bold text-[#111111] uppercase tracking-wider mb-2 border-b border-[#E5E5E5] pb-1">
              Telemetry Tool Connectors
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#525252]">CrowdStrike EDR</span>
              <span className="text-emerald-600 font-semibold">
                {systemHealth.toolHealth.edr}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#525252]">Palo Alto Firewall</span>
              <span className="text-emerald-600 font-semibold">
                {systemHealth.toolHealth.firewall}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#525252]">Splunk / Chronicle SIEM</span>
              <span className="text-emerald-600 font-semibold">
                {systemHealth.toolHealth.siem}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#525252]">AWS GuardDuty</span>
              <span className="text-emerald-600 font-semibold">
                {systemHealth.toolHealth.cloudLogs}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
