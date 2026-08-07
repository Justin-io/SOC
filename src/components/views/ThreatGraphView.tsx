import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Network, ShieldAlert, Server, Globe } from 'lucide-react';
import { Incident } from '../../types/soc';
import { Card } from '../ui/Card';

interface ThreatGraphViewProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
}

export const ThreatGraphView: React.FC<ThreatGraphViewProps> = ({
  incidents,
  onSelectIncident,
}) => {
  const nodes: Node[] = useMemo(() => {
    const list: Node[] = [];

    // Central Threat Hub Node
    list.push({
      id: 'HUB-GLOBAL',
      data: { label: 'AEGIS-X Core SOC Mesh', type: 'HUB' },
      position: { x: 400, y: 50 },
      style: {
        background: '#111111',
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: '12px',
        padding: '10px 16px',
        borderRadius: '6px',
        border: '1px solid #111111',
      },
    });

    incidents.forEach((inc, idx) => {
      const incX = (idx % 3) * 300 + 100;
      const incY = Math.floor(idx / 3) * 220 + 200;

      // Incident Node
      list.push({
        id: inc.id,
        data: { label: `${inc.id}: ${inc.title.slice(0, 25)}...`, type: 'INCIDENT', inc },
        position: { x: incX, y: incY },
        style: {
          background: '#FFFFFF',
          color: '#111111',
          border: '1px solid #E5E5E5',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '11px',
          fontFamily: 'monospace',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        },
      });

      // Asset Node attached to Incident
      list.push({
        id: `AST-${inc.id}`,
        data: { label: `Asset: ${inc.asset.hostname}`, type: 'ASSET' },
        position: { x: incX, y: incY + 90 },
        style: {
          background: '#FAFAFA',
          color: '#525252',
          border: '1px border-dashed #E5E5E5',
          borderRadius: '4px',
          padding: '6px 10px',
          fontSize: '10px',
          fontFamily: 'monospace',
        },
      });
    });

    return list;
  }, [incidents]);

  const edges: Edge[] = useMemo(() => {
    const list: Edge[] = [];

    incidents.forEach((inc) => {
      list.push({
        id: `e-hub-${inc.id}`,
        source: 'HUB-GLOBAL',
        target: inc.id,
        animated: true,
        style: { stroke: inc.severity === 'CRITICAL' ? '#DC2626' : '#2563EB', strokeWidth: 2 },
      });

      list.push({
        id: `e-${inc.id}-ast`,
        source: inc.id,
        target: `AST-${inc.id}`,
        style: { stroke: '#737373', strokeDasharray: '4 4' },
      });
    });

    return list;
  }, [incidents]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Global Incident & Asset Threat Graph
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Full Enterprise Attack Surface Linkage & Dependency Map
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Network size={16} className="text-blue-600" />
          <span className="font-bold text-[#111111]">REACT FLOW CLUSTER GRAPH</span>
        </div>
      </div>

      <div className="h-[700px] bg-[#FAFAFA] border border-[#E5E5E5] rounded-md overflow-hidden relative shadow-xs">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeClick={(_, node) => {
            if (node.id.startsWith('INC-')) {
              onSelectIncident(node.id);
            }
          }}
        >
          <Background color="#E5E5E5" gap={20} />
          <Controls />
        </ReactFlow>

        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-xs border border-[#E5E5E5] p-3 rounded font-mono text-[10px] space-y-1">
          <div className="font-bold text-[#111111] border-b border-[#E5E5E5] pb-1">
            GRAPH LEGEND
          </div>
          <div className="flex items-center gap-2 text-[#525252]">
            <span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" />
            <span>Critical Severity Edge</span>
          </div>
          <div className="flex items-center gap-2 text-[#525252]">
            <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />
            <span>High/Medium Edge</span>
          </div>
        </div>
      </div>
    </div>
  );
};
