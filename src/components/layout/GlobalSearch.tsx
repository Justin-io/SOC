import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, Bot, Globe, FileText, Sliders, X } from 'lucide-react';
import { Incident, AgentMetrics, IOCItem, SOCReport } from '../../types/soc';
import { ViewType } from './Sidebar';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  agents: AgentMetrics[];
  iocs: IOCItem[];
  reports: SOCReport[];
  onNavigateView: (view: ViewType, itemId?: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  incidents,
  agents,
  iocs,
  reports,
  onNavigateView,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open search
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredIncidents = incidents.filter(
    (i) =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.id.toLowerCase().includes(query.toLowerCase()) ||
      i.asset.hostname.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.role.toLowerCase().includes(query.toLowerCase())
  );

  const filteredIOCs = iocs.filter((ioc) =>
    ioc.value.toLowerCase().includes(query.toLowerCase())
  );

  const filteredReports = reports.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (view: ViewType, id?: string) => {
    onNavigateView(view, id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
      <div className="bg-white border border-[#E5E5E5] rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden font-sans">
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3 border-b border-[#E5E5E5] gap-3">
          <Search size={18} className="text-[#737373]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search incidents, hosts, agents, IOCs, reports..."
            className="w-full bg-transparent text-sm text-[#111111] focus:outline-none font-mono"
          />
          <button
            onClick={onClose}
            className="p-1 text-[#737373] hover:text-[#111111] rounded hover:bg-[#F5F5F5]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Incidents Section */}
          {filteredIncidents.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#737373] flex items-center gap-1.5">
                <ShieldAlert size={12} />
                <span>Incidents ({filteredIncidents.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {filteredIncidents.slice(0, 4).map((inc) => (
                  <button
                    key={inc.id}
                    onClick={() => handleSelect('incident-room', inc.id)}
                    className="w-full text-left px-3 py-2 rounded text-xs hover:bg-[#F5F5F5] flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-[#111111]">{inc.id}</span>
                      <span className="text-[#525252] truncate max-w-[340px] font-sans">
                        {inc.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                      {inc.severity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agents Section */}
          {filteredAgents.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#737373] flex items-center gap-1.5">
                <Bot size={12} />
                <span>AI Agents ({filteredAgents.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {filteredAgents.slice(0, 4).map((agent) => (
                  <button
                    key={agent.role}
                    onClick={() => handleSelect('agent-observatory', agent.role)}
                    className="w-full text-left px-3 py-2 rounded text-xs hover:bg-[#F5F5F5] flex items-center justify-between"
                  >
                    <span className="font-medium text-[#111111]">{agent.name}</span>
                    <span className="font-mono text-[10px] text-[#737373]">{agent.model}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Threat IOCs Section */}
          {filteredIOCs.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#737373] flex items-center gap-1.5">
                <Globe size={12} />
                <span>Threat Intelligence IOCs ({filteredIOCs.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {filteredIOCs.slice(0, 3).map((ioc) => (
                  <button
                    key={ioc.value}
                    onClick={() => handleSelect('threat-intel', ioc.value)}
                    className="w-full text-left px-3 py-2 rounded text-xs hover:bg-[#F5F5F5] flex items-center justify-between font-mono"
                  >
                    <span className="font-semibold text-[#111111]">{ioc.value}</span>
                    <span className="text-[10px] text-red-600 font-semibold">{ioc.reputation}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reports Section */}
          {filteredReports.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#737373] flex items-center gap-1.5">
                <FileText size={12} />
                <span>Reports ({filteredReports.length})</span>
              </div>
              <div className="mt-1 space-y-1">
                {filteredReports.slice(0, 3).map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() => handleSelect('reports', rep.id)}
                    className="w-full text-left px-3 py-2 rounded text-xs hover:bg-[#F5F5F5] flex items-center justify-between"
                  >
                    <span className="text-[#111111] font-medium truncate">{rep.title}</span>
                    <span className="font-mono text-[10px] text-[#737373]">{rep.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredIncidents.length === 0 &&
            filteredAgents.length === 0 &&
            filteredIOCs.length === 0 &&
            filteredReports.length === 0 && (
              <div className="py-8 text-center text-xs font-mono text-[#737373]">
                No operational matches found for "{query}"
              </div>
            )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between text-[10px] font-mono text-[#737373]">
          <div className="flex items-center gap-3">
            <span>[ESC] Close</span>
            <span>[ENTER] Navigate</span>
          </div>
          <span>AEGIS-X Command Palette v4.1</span>
        </div>
      </div>
    </div>
  );
};
