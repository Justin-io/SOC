import React, { useState } from 'react';
import {
  Cpu,
  Shield,
  AlertCircle,
  CheckCircle2,
  Lock,
  RotateCcw,
  DollarSign,
  TrendingDown,
  Users,
} from 'lucide-react';
import { NetworkNode, DigitalTwinState } from '../../types/soc';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface DigitalTwinViewProps {
  nodes: NetworkNode[];
  digitalTwinState: DigitalTwinState;
  onToggleIsolationNode: (nodeId: string) => void;
  onResetSimulation: () => void;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  nodes,
  digitalTwinState,
  onToggleIsolationNode,
  onResetSimulation,
}) => {
  const [activeTab, setActiveTab] = useState<'SIDE_BY_SIDE' | 'BEFORE' | 'AFTER'>('SIDE_BY_SIDE');

  const isolatedCount = nodes.filter((n) => n.status === 'ISOLATED' || n.status === 'SIMULATED_ISOLATION').length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Infrastructure Digital Twin & Containment Simulator
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Predictive Attack Graph Topology & Risk Reduction Modeling
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Button variant="outline" size="sm" onClick={onResetSimulation}>
            <RotateCcw size={13} className="mr-1.5" />
            <span>Reset Digital Twin Topology</span>
          </Button>
        </div>
      </div>

      {/* Synchronized Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 font-mono">
        <Card className="p-3 bg-red-50/50 border-red-200">
          <div className="text-[10px] text-red-800 font-bold uppercase">RISK BEFORE</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {digitalTwinState.totalRiskBefore}%
          </div>
        </Card>

        <Card className="p-3 bg-emerald-50/50 border-emerald-200">
          <div className="text-[10px] text-emerald-800 font-bold uppercase">RISK AFTER</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {digitalTwinState.totalRiskAfter}%
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] text-[#737373] font-bold uppercase">PROJECTED VICTIMS</div>
          <div className="text-xl font-bold text-[#111111] mt-1">
            {digitalTwinState.projectedVictimsBefore} →{' '}
            <span className="text-emerald-600">{digitalTwinState.projectedVictimsAfter}</span>
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] text-[#737373] font-bold uppercase">ESTIMATED LOSS SAVED</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            ${(digitalTwinState.estimatedBusinessCost / 1000).toFixed(0)}k
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] text-[#737373] font-bold uppercase">CONTAINMENT COST</div>
          <div className="text-xl font-bold text-[#111111] mt-1">
            ${digitalTwinState.estimatedContainmentCost}
          </div>
        </Card>

        <Card className="p-3 bg-blue-50/50 border-blue-200">
          <div className="text-[10px] text-blue-900 font-bold uppercase">EFFECTIVENESS</div>
          <div className="text-xl font-bold text-blue-700 mt-1">
            {digitalTwinState.containmentEffectiveness}%
          </div>
        </Card>
      </div>

      {/* Main Topologies: Side-by-Side Diagram Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: BEFORE Containment */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 font-mono text-xs">
            <h2 className="font-bold text-red-600 flex items-center gap-1.5">
              <AlertCircle size={15} />
              <span>BEFORE CONTAINMENT (PRE-ATTACK WAVE)</span>
            </h2>
            <span className="text-[#737373]">Uncontained Propagation</span>
          </div>

          <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-md p-4 space-y-3 min-h-[440px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
              {nodes.map((node) => {
                const isDanger = node.riskLevel === 'CRITICAL' || node.riskLevel === 'DANGER';
                return (
                  <div
                    key={`before-${node.id}`}
                    className={`p-3 rounded border space-y-1.5 ${
                      isDanger
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : 'bg-white border-[#E5E5E5] text-[#111111]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span>{node.label}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-white/80 border">
                        {node.type}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-80">{node.ip}</div>
                    <div className="flex justify-between items-center text-[10px] font-bold pt-1 border-t border-black/10">
                      <span>Status:</span>
                      <span>{node.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: AFTER Containment (Interactive Isolation Sandbox) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2 font-mono text-xs">
            <h2 className="font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              <span>AFTER CONTAINMENT (SIMULATED TOPOLOGY)</span>
            </h2>
            <span className="text-emerald-700 font-semibold">{isolatedCount} Hosts Isolated</span>
          </div>

          <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-md p-4 space-y-3 min-h-[440px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
              {nodes.map((node) => {
                const isIsolated = node.status === 'ISOLATED' || node.status === 'SIMULATED_ISOLATION';
                return (
                  <div
                    key={`after-${node.id}`}
                    onClick={() => onToggleIsolationNode(node.id)}
                    className={`p-3 rounded border space-y-1.5 cursor-pointer transition-all ${
                      isIsolated
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                        : 'bg-white border-[#E5E5E5] text-[#111111] hover:border-[#111111]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span>{node.label}</span>
                      {isIsolated ? (
                        <Lock size={12} className="text-emerald-600" />
                      ) : (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#FAFAFA] border">
                          {node.type}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] opacity-80">{node.ip}</div>
                    <div className="flex justify-between items-center text-[10px] font-bold pt-1 border-t border-black/10">
                      <span>Click To Toggle:</span>
                      <span className={isIsolated ? 'text-emerald-700 font-bold' : 'text-[#737373]'}>
                        {isIsolated ? 'ISOLATED' : 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
