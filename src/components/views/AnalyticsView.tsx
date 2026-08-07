import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, ShieldAlert, Cpu, Clock } from 'lucide-react';
import { Card } from '../ui/Card';

export const AnalyticsView: React.FC = () => {
  const incidentTrendData = [
    { day: 'Mon', Critical: 2, High: 5, Medium: 12 },
    { day: 'Tue', Critical: 1, High: 8, Medium: 15 },
    { day: 'Wed', Critical: 4, High: 12, Medium: 18 },
    { day: 'Thu', Critical: 3, High: 6, Medium: 10 },
    { day: 'Fri', Critical: 2, High: 9, Medium: 14 },
    { day: 'Sat', Critical: 0, High: 3, Medium: 6 },
    { day: 'Sun', Critical: 1, High: 4, Medium: 8 },
  ];

  const severityPieData = [
    { name: 'Critical', value: 14, color: '#DC2626' },
    { name: 'High', value: 38, color: '#F59E0B' },
    { name: 'Medium', value: 84, color: '#2563EB' },
    { name: 'Low', value: 42, color: '#16A34A' },
  ];

  const mitreCoverageData = [
    { tactic: 'Initial Access', coverage: 94 },
    { tactic: 'Execution', coverage: 98 },
    { tactic: 'Persistence', coverage: 91 },
    { tactic: 'PrivEsc', coverage: 88 },
    { tactic: 'Defense Evasion', coverage: 95 },
    { tactic: 'Cred Access', coverage: 92 },
    { tactic: 'Discovery', coverage: 89 },
    { tactic: 'Lateral Movement', coverage: 96 },
    { tactic: 'Exfiltration', coverage: 90 },
  ];

  const agentLatencyData = [
    { agent: 'Coordinator', latency: 142 },
    { agent: 'ThreatIntel', latency: 84 },
    { agent: 'Malware', latency: 310 },
    { agent: 'Cloud', latency: 110 },
    { agent: 'IncidentResp', latency: 92 },
    { agent: 'Compliance', latency: 78 },
    { agent: 'Edge', latency: 68 },
    { agent: 'Deception', latency: 52 },
    { agent: 'Human', latency: 125 },
    { agent: 'Fusion', latency: 195 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            SOC Enterprise Intelligence & Analytical Metrics
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Conformal Risk Distribution, MITRE Coverage & Model Performance Metrics
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <BarChart3 size={16} className="text-[#111111]" />
          <span className="font-bold text-[#111111]">RECHARTS ENTERPRISE SUITE</span>
        </div>
      </div>

      {/* Grid of 4 Key Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Incident Trends */}
        <Card className="p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h3 className="font-bold text-[#111111] text-sm flex items-center gap-2">
              <TrendingUp size={15} />
              <span>Weekly Incident Volume & Severity Breakdown</span>
            </h3>
            <span className="text-[10px] text-[#737373]">7-Day Window</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="day" stroke="#737373" fontSize={11} />
                <YAxis stroke="#737373" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', color: '#FFF', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="Critical" fill="#DC2626" stackId="a" />
                <Bar dataKey="High" fill="#F59E0B" stackId="a" />
                <Bar dataKey="Medium" fill="#2563EB" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Severity Distribution Pie */}
        <Card className="p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h3 className="font-bold text-[#111111] text-sm flex items-center gap-2">
              <ShieldAlert size={15} />
              <span>Incident Severity Distribution</span>
            </h3>
            <span className="text-[10px] text-[#737373]">Total: 178 Events</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', color: '#FFF', borderRadius: '4px', fontSize: '11px' }}
                />
                <Legend formatter={(val) => <span className="text-xs font-mono text-[#111111]">{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 3: MITRE ATT&CK Framework Coverage */}
        <Card className="p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h3 className="font-bold text-[#111111] text-sm flex items-center gap-2">
              <Cpu size={15} />
              <span>MITRE ATT&CK Tactic Detection Coverage (%)</span>
            </h3>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Avg: 92.4%
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mitreCoverageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis type="number" domain={[0, 100]} stroke="#737373" fontSize={11} />
                <YAxis dataKey="tactic" type="category" stroke="#737373" fontSize={10} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', color: '#FFF', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="coverage" fill="#111111" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 4: Agent Latency Profile */}
        <Card className="p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
            <h3 className="font-bold text-[#111111] text-sm flex items-center gap-2">
              <Clock size={15} />
              <span>Agent Execution Latency Benchmark (ms)</span>
            </h3>
            <span className="text-[10px] text-[#737373]">10 Agents Analyzed</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agentLatencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="agent" stroke="#737373" fontSize={10} />
                <YAxis stroke="#737373" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111111', color: '#FFF', borderRadius: '4px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="latency" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
