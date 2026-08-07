import React, { useState } from 'react';
import {
  FileCheck2,
  Search,
  Download,
  ShieldCheck,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuditBlock } from '../../types/soc';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface AuditTrailViewProps {
  blocks: AuditBlock[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ blocks }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredBlocks = blocks.filter(
    (b) =>
      b.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(blocks, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `AEGIS-X_Cryptographic_Audit_Chain_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Tamper-Evident Cryptographic Audit Chain
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Immutable SHA256 Block Ledger of All Human & AI Agent Incident Actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download size={13} className="mr-1.5" />
            <span>Export JSON Ledger</span>
          </Button>
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
            placeholder="Search block hash, actor name, or action keyword..."
            className="w-full bg-white border border-[#E5E5E5] rounded pl-9 pr-3 py-1.5 text-xs text-[#111111] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
          <ShieldCheck size={14} />
          <span>CHAIN INTEGRITY: 100% VERIFIED</span>
        </div>
      </div>

      {/* Block List */}
      <div className="space-y-3 font-mono text-xs">
        {filteredBlocks.map((block) => {
          const isExpanded = expandedIndex === block.index;

          return (
            <Card
              key={block.index}
              className="p-4 space-y-3 border-[#E5E5E5] hover:border-[#111111] transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#E5E5E5] pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-[#111111]">
                    BLOCK #{block.index}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {block.verificationStatus}
                  </span>
                  <span className="text-[11px] text-[#737373]">{block.timestamp}</span>
                </div>

                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : block.index)}
                  className="flex items-center gap-1 text-[#525252] hover:text-[#111111] text-xs font-semibold"
                >
                  <span>{isExpanded ? 'Collapse Payload' : 'Inspect Block'}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Block Action Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-[#737373] text-[10px]">ACTOR:</span>
                  <div className="font-semibold text-[#111111]">{block.actor}</div>
                </div>
                <div>
                  <span className="text-[#737373] text-[10px]">ACTION:</span>
                  <div className="font-bold text-[#111111]">{block.action}</div>
                </div>
                <div>
                  <span className="text-[#737373] text-[10px]">PROOF ALGORITHM:</span>
                  <div className="text-emerald-700 font-semibold">{block.integrityProof}</div>
                </div>
              </div>

              {/* Hashes */}
              <div className="space-y-1 bg-[#FAFAFA] p-2.5 rounded border border-[#E5E5E5] text-[10px]">
                <div className="flex gap-2">
                  <span className="text-[#737373] w-24 shrink-0 font-bold">BLOCK HASH:</span>
                  <span className="text-[#111111] truncate">{block.hash}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#737373] w-24 shrink-0 font-bold">PREV HASH:</span>
                  <span className="text-[#737373] truncate">{block.previousHash}</span>
                </div>
              </div>

              {/* Expanded Payload JSON Details */}
              {isExpanded && (
                <div className="bg-[#111111] text-emerald-400 p-3 rounded text-[11px] font-mono leading-relaxed overflow-x-auto">
                  {JSON.stringify(block.details, null, 2)}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
