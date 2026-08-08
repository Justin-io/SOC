import React, { useState, useEffect } from 'react';
import {
  Shield,
  Zap,
  Brain,
  Radio,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Lock,
  Target,
  Activity,
  Search,
  Database,
} from 'lucide-react';
import { Incident } from '../../types/soc';

interface SimulationStep {
  id: string;
  label: string;
  detail: string;
  durationMs: number;
}

interface SimulationOverlayProps {
  visible: boolean;
  result: Incident | null;
  onDismiss: () => void;
}

const SIMULATION_STEPS: SimulationStep[] = [
  {
    id: 'ingest',
    label: 'AEGIS-X Telemetry Bus Activated',
    detail: 'Raw sensor signal received from hybrid cloud ingestion layer. Normalizing alert schema...',
    durationMs: 700,
  },
  {
    id: 'triage',
    label: 'Tier-0 Edge Triage (0.6B Model)',
    detail: 'Quantized local model performing MITRE ATT&CK classification at <45ms. Routing to cascade...',
    durationMs: 900,
  },
  {
    id: 'gemini',
    label: 'Gemini Pro — Threat Vector Analysis',
    detail: 'Cloud LLM performing deep counterfactual reasoning. Evaluating lateral movement risk across domain topology...',
    durationMs: 1400,
  },
  {
    id: 'ioc',
    label: 'IOC Intelligence Cross-Reference',
    detail: 'Querying VirusTotal, AbuseIPDB, and MITRE ATT&CK knowledge base for threat actor attribution...',
    durationMs: 800,
  },
  {
    id: 'deception',
    label: 'Deception Mesh — Honeytoken Check',
    detail: 'Scanning canary credential access logs. HONEY-VAULT-DB deception agent reporting activity...',
    durationMs: 600,
  },
  {
    id: 'chronon',
    label: 'Chronon Engine — Wavefront Prediction',
    detail: 'Running CFL-stable damped wave equation on network graph. Predicting lateral movement trajectory...',
    durationMs: 700,
  },
  {
    id: 'agents',
    label: 'Multi-Agent Debate (10 Agents)',
    detail: 'COORDINATOR, THREAT_INTEL, MALWARE, CLOUD, EDGE agents converging on consensus risk score...',
    durationMs: 1000,
  },
  {
    id: 'containment',
    label: 'Autonomous Containment Directive Issued',
    detail: 'Conformal risk gate cleared. Playbook sealed. Awaiting human-in-the-loop approval...',
    durationMs: 600,
  },
  {
    id: 'complete',
    label: 'Incident Registered — Mission Control Updated',
    detail: 'New incident inserted into SOC console. All 10 agents assigned. Evidence chain sealed.',
    durationMs: 400,
  },
];

function getTotalDuration(): number {
  return SIMULATION_STEPS.reduce((s, step) => s + step.durationMs, 0);
}

export const SimulationOverlay: React.FC<SimulationOverlayProps> = ({
  visible,
  result,
  onDismiss,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCurrentStep(-1);
      setCompletedSteps(new Set());
      setIsDone(false);
      return;
    }

    let accumulated = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    SIMULATION_STEPS.forEach((step, idx) => {
      const activateAt = accumulated;
      timeouts.push(setTimeout(() => { setCurrentStep(idx); }, activateAt));

      const completeAt = accumulated + step.durationMs - 100;
      timeouts.push(
        setTimeout(() => {
          setCompletedSteps((prev) => new Set([...prev, idx]));
        }, completeAt)
      );

      accumulated += step.durationMs;
    });

    timeouts.push(setTimeout(() => { setIsDone(true); }, getTotalDuration()));

    return () => timeouts.forEach(clearTimeout);
  }, [visible]);

  if (!visible) return null;

  const severityColor =
    result?.severity === 'CRITICAL'
      ? 'text-red-400'
      : result?.severity === 'HIGH'
      ? 'text-amber-400'
      : 'text-yellow-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-[#0A0A0A] border border-[#222] rounded-xl shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1A1A1A] bg-gradient-to-r from-[#0d0d0d] to-[#111]">
          <Shield size={18} className="text-amber-400 animate-pulse" />
          <span className="text-white font-bold text-sm tracking-widest uppercase">
            AEGIS-X Multi-Agent Cascade
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-red-400 text-xs font-bold tracking-widest">LIVE SIMULATION</span>
          </div>
        </div>

        {/* Steps List */}
        <div className="px-6 py-4 space-y-2 max-h-80 overflow-y-auto">
          {SIMULATION_STEPS.map((step, idx) => {
            const isActive = currentStep === idx && !completedSteps.has(idx);
            const isCompleted = completedSteps.has(idx);

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-white/5 border border-white/10'
                    : isCompleted
                    ? 'bg-emerald-950/30 border border-emerald-900/30'
                    : 'opacity-30'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0 w-4">
                  {isActive ? (
                    <Loader2 size={16} className="text-white animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle size={16} className="text-emerald-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#333]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isCompleted ? 'text-emerald-400' : isActive ? 'text-white' : 'text-[#666]'
                    }`}
                  >
                    {step.label}
                  </div>
                  {(isActive || isCompleted) && (
                    <div className="text-[10px] text-[#888] mt-0.5 leading-relaxed">{step.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="px-6 pb-3">
          <div className="w-full bg-[#1A1A1A] h-1 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${Math.round((completedSteps.size / SIMULATION_STEPS.length) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-[#555] tracking-widest">
            <span>INGESTION</span>
            <span>CASCADE ROUTER</span>
            <span>DECISION ENGINE</span>
          </div>
        </div>

        {/* Result Card */}
        {isDone && result && (
          <div className="mx-6 mb-4 p-4 bg-[#111] rounded-lg border border-[#2A2A2A] space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className={severityColor} />
              <span className={`text-xs font-bold ${severityColor}`}>{result.severity} INCIDENT REGISTERED</span>
              <span className="ml-auto text-[10px] text-[#555] font-mono">{result.id}</span>
            </div>
            <p className="text-white text-xs font-semibold leading-snug">{result.title}</p>
            <p className="text-[#888] text-[10px] leading-relaxed line-clamp-2">{result.description}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] font-mono">
              <span className="text-[#555]">Asset:</span>
              <span className="text-emerald-400 font-bold">{result.asset.hostname}</span>
              <span className="text-[#555]">MITRE:</span>
              <span className="text-purple-400 font-bold">{result.mitreTechnique.id}</span>
              <span className="text-[#555]">Confidence:</span>
              <span className="text-amber-400 font-bold">{result.confidence}%</span>
              <span className="text-[#555]">Risk:</span>
              <span className="text-red-400 font-bold">{result.riskScore}</span>
            </div>
            <button
              onClick={onDismiss}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-white text-black text-xs font-bold tracking-widest hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Zap size={13} className="text-amber-500 fill-amber-500" />
              OPEN INCIDENT ROOM
            </button>
          </div>
        )}

        {/* Bottom Label */}
        {!isDone && (
          <div className="px-6 pb-5 text-[10px] text-[#444] text-center tracking-widest animate-pulse">
            {currentStep >= 0 ? SIMULATION_STEPS[currentStep]?.label.toUpperCase() : 'INITIALIZING AEGIS-X CASCADE...'}
          </div>
        )}
      </div>
    </div>
  );
};
