import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  AlertTriangle,
  Zap,
  Layers,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const ChrononView: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [emulationStep, setEmulationStep] = useState<number>(2);
  const [selectedVictim, setSelectedVictim] = useState<string | null>('DC01-PROD-EAST');

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setEmulationStep((prev) => (prev >= 100 ? 0 : prev + 1));
    }, 300 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const nodes = [
    { id: 'DC01-PROD-EAST', name: 'Domain Controller DC01', rootCause: true, riskAtStep: (s: number) => Math.min(100, s * 4) },
    { id: 'DC02-PROD-EAST', name: 'Backup DC02', rootCause: false, riskAtStep: (s: number) => Math.min(100, Math.max(0, (s - 10) * 3)) },
    { id: 'SQL-PROD-CORE', name: 'PostgreSQL Core DB Cluster', rootCause: false, riskAtStep: (s: number) => Math.min(100, Math.max(0, (s - 20) * 3.5)) },
    { id: 'S3-FINANCE-DATA', name: 'AWS S3 Customer Data Lake', rootCause: false, riskAtStep: (s: number) => Math.min(100, Math.max(0, (s - 30) * 4)) },
    { id: 'WRK-FINANCE-09', name: 'Workstation WRK-FINANCE-09', rootCause: false, riskAtStep: (s: number) => Math.min(100, Math.max(0, (s - 40) * 2.5)) },
    { id: 'K8S-WORKER-04', name: 'Kubernetes Worker Node 04', rootCause: false, riskAtStep: (s: number) => Math.min(100, Math.max(0, (s - 50) * 2)) },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Chronon Time-Series Risk Wave Propagation
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Heatmap Emulation of Infrastructural Contagion & Attacker Wave Velocity
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Clock size={16} className="text-amber-600" />
          <span className="font-bold text-[#111111]">T + {emulationStep * 6} seconds</span>
        </div>
      </div>

      {/* Playback Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-md font-mono text-xs gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={isPlaying ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={14} className="mr-1" /> : <Play size={14} className="mr-1" />}
            <span>{isPlaying ? 'Pause Wave' : 'Resume Wave'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setEmulationStep(0)}>
            <RotateCcw size={13} className="mr-1" />
            <span>Reset Time</span>
          </Button>

          <div className="flex items-center gap-1 ml-4 border-l border-[#E5E5E5] pl-4">
            <span className="text-[#737373]">SPEED:</span>
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded border text-[10px] font-bold ${
                  speed === s
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Time Slider */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <span className="text-[#737373] text-[10px]">T=0s</span>
          <input
            type="range"
            min={0}
            max={100}
            value={emulationStep}
            onChange={(e) => setEmulationStep(Number(e.target.value))}
            className="w-full accent-[#111111]"
          />
          <span className="text-[#737373] text-[10px]">T=600s</span>
        </div>
      </div>

      {/* Heatmap Infrastructure Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.map((node) => {
          const riskPercent = Math.round(node.riskAtStep(emulationStep));
          let colorClass = 'bg-[#FAFAFA] border-[#E5E5E5] text-[#111111]';
          if (riskPercent > 70) {
            colorClass = 'bg-red-50 border-red-300 text-red-900';
          } else if (riskPercent > 30) {
            colorClass = 'bg-amber-50 border-amber-300 text-amber-900';
          }

          const isSelected = selectedVictim === node.id;

          return (
            <Card
              key={node.id}
              onClick={() => setSelectedVictim(node.id)}
              hoverable
              className={`p-4 space-y-3 font-mono text-xs transition-colors cursor-pointer ${colorClass} ${
                isSelected ? 'ring-2 ring-[#111111]' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-black/10 pb-2">
                <div className="font-bold text-[#111111] text-sm">{node.name}</div>
                {node.rootCause && (
                  <span className="text-[9px] font-bold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded">
                    ROOT CAUSE NODE
                  </span>
                )}
              </div>

              <div className="flex justify-between items-baseline">
                <span className="text-[#737373] text-[10px]">PROPAGATED RISK:</span>
                <span className="text-xl font-bold">{riskPercent}%</span>
              </div>

              <div className="w-full bg-black/10 h-2 rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    riskPercent > 70
                      ? 'bg-red-600'
                      : riskPercent > 30
                      ? 'bg-amber-500'
                      : 'bg-zinc-400'
                  }`}
                  style={{ width: `${riskPercent}%` }}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Root Cause & Propagation Path Tracing */}
      {selectedVictim && (
        <Card className="p-4 font-mono text-xs space-y-2 border-[#111111]">
          <div className="font-bold text-[#111111] text-sm flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <span>Contagion Propagation Path & Root Cause Trace</span>
          </div>
          <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded text-[11px] leading-relaxed text-[#525252]">
            Target Node: <strong className="text-[#111111]">{selectedVictim}</strong> ← Wave propagated from Initial Exploit Vector <strong className="text-red-600">DC01-PROD-EAST (Domain Controller)</strong> at T+0s via active LSASS Kerberos ticket dump.
          </div>
        </Card>
      )}
    </div>
  );
};
