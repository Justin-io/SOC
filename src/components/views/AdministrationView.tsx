import React, { useState } from 'react';
import {
  Sliders,
  Save,
  Bot,
  Server,
  Key,
  Database,
  FileText,
} from 'lucide-react';
import { SystemSettings, AgentMetrics, AgentRole } from '../../types/soc';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MathSpecDoc } from './MathSpecDoc';

interface AdministrationViewProps {
  settings: SystemSettings;
  agents: AgentMetrics[];
  onSaveSettings: (newSettings: SystemSettings) => void;
  onUpdateAgentModel: (role: AgentRole, model: string) => void;
  onToggleAgentActive: (role: AgentRole) => void;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  settings,
  agents,
  onSaveSettings,
  onUpdateAgentModel,
  onToggleAgentActive,
}) => {
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showMathSpecPage, setShowMathSpecPage] = useState(false);

  const handleSave = () => {
    onSaveSettings(localSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  if (showMathSpecPage) {
    return <MathSpecDoc onBack={() => setShowMathSpecPage(false)} />;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            AEGIS-X SOC Administration & Control Parameters
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Model Routing, Autonomous Containment Thresholds & Infrastructure Configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              Settings Saved
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowMathSpecPage(true)}>
            <FileText size={14} className="mr-1.5" />
            <span>Math & Algo Docs</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            <Save size={14} className="mr-1.5" />
            <span>Save Control Parameters</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Sliders & Thresholds (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-5 space-y-4 font-mono text-xs">
            <h2 className="text-sm font-bold text-[#111111] border-b border-[#E5E5E5] pb-2 flex items-center gap-2">
              <Sliders size={16} />
              <span>Conformal Risk & SLA Threshold Controls</span>
            </h2>

            {/* Auto Containment Risk Cutoff */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-[#111111] font-semibold">
                  Autonomous Containment Cutoff (% Probability)
                </label>
                <span className="font-bold text-red-600">
                  {localSettings.autoContainmentRiskThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                value={localSettings.autoContainmentRiskThreshold}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    autoContainmentRiskThreshold: Number(e.target.value),
                  })
                }
                className="w-full accent-[#111111]"
              />
              <p className="text-[10px] text-[#737373] font-sans">
                Incidents scoring above this probability trigger auto-isolation without human sign-off.
              </p>
            </div>

            {/* Dissent Sensitivity */}
            <div className="space-y-1.5 border-t border-[#E5E5E5] pt-3">
              <div className="flex justify-between">
                <label className="text-[#111111] font-semibold">
                  Multi-Agent Dissent Sensitivity Threshold
                </label>
                <span className="font-bold text-amber-600">
                  {localSettings.dissentSensitivityThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                value={localSettings.dissentSensitivityThreshold}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    dissentSensitivityThreshold: Number(e.target.value),
                  })
                }
                className="w-full accent-[#111111]"
              />
            </div>

            {/* Human SLA Timeout */}
            <div className="space-y-1.5 border-t border-[#E5E5E5] pt-3">
              <div className="flex justify-between">
                <label className="text-[#111111] font-semibold">
                  Human SLA Approval Timeout (Minutes)
                </label>
                <span className="font-bold text-[#111111]">
                  {localSettings.humanSlaTimeoutMinutes}m
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={localSettings.humanSlaTimeoutMinutes}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    humanSlaTimeoutMinutes: Number(e.target.value),
                  })
                }
                className="w-full accent-[#111111]"
              />
            </div>

            {/* Conformal Coverage Alpha */}
            <div className="space-y-1.5 border-t border-[#E5E5E5] pt-3">
              <div className="flex justify-between">
                <label className="text-[#111111] font-semibold">
                  Conformal Guarantee Alpha Value (Coverage)
                </label>
                <span className="font-bold text-emerald-700">
                  {localSettings.conformalCoverageAlpha}
                </span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.2}
                step={0.01}
                value={localSettings.conformalCoverageAlpha}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    conformalCoverageAlpha: Number(e.target.value),
                  })
                }
                className="w-full accent-[#111111]"
              />
            </div>
          </Card>

          {/* Infrastructure Health & API Secrets */}
          <Card className="p-5 space-y-3 font-mono text-xs">
            <h2 className="text-sm font-bold text-[#111111] border-b border-[#E5E5E5] pb-2 flex items-center gap-2">
              <Server size={16} />
              <span>Infrastructure Connectors & Gemini Keys</span>
            </h2>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-[#FAFAFA] border rounded">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-[#737373]" />
                  <span>GEMINI API KEY (SERVER PROXY)</span>
                </div>
                <span className="text-emerald-600 font-bold">CONFIGURED</span>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#FAFAFA] border rounded">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-[#737373]" />
                  <span>SUPABASE REALTIME PERSISTENCE</span>
                </div>
                <span className="text-emerald-600 font-bold">ACTIVE / CONNECTED</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Agent Model Routing & Toggles (6 Cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-5 space-y-4 font-mono text-xs">
            <h2 className="text-sm font-bold text-[#111111] border-b border-[#E5E5E5] pb-2 flex items-center gap-2">
              <Bot size={16} />
              <span>10-Agent LLM Model Assignment & Status</span>
            </h2>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {agents.map((agent) => (
                <div
                  key={agent.role}
                  className="p-3 border border-[#E5E5E5] rounded bg-[#FAFAFA] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#111111]">{agent.role}</div>
                    <div className="text-[10px] text-[#737373] truncate">{agent.name}</div>
                  </div>

                  <select
                    value={agent.model}
                    onChange={(e) => onUpdateAgentModel(agent.role, e.target.value)}
                    className="bg-white border border-[#E5E5E5] rounded px-2 py-1 text-[11px] text-[#111111] focus:outline-none"
                  >
                    <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    <option value="gemini-3.5-pro">gemini-3.5-pro</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                    <option value="gpt-4o">gpt-4o</option>
                  </select>

                  <button
                    onClick={() => onToggleAgentActive(agent.role)}
                    className={`px-2 py-1 rounded text-[10px] font-bold border ${
                      agent.status !== 'DEGRADED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    {agent.status !== 'DEGRADED' ? 'ACTIVE' : 'PAUSED'}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
};
