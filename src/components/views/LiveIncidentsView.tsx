import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  ShieldAlert,
  ArrowUpDown,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { Incident, Severity, IncidentStatus } from '../../types/soc';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ViewType } from '../layout/Sidebar';

interface LiveIncidentsViewProps {
  incidents: Incident[];
  onNavigateView: (view: ViewType, incidentId?: string) => void;
  onUpdateIncidentStatus: (id: string, status: IncidentStatus) => void;
}

export const LiveIncidentsView: React.FC<LiveIncidentsViewProps> = ({
  incidents,
  onNavigateView,
  onUpdateIncidentStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Incident>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter logic
  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      inc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.asset.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.mitreTechnique.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      selectedSeverity === 'ALL' || inc.severity === selectedSeverity;

    const matchesStatus =
      selectedStatus === 'ALL' || inc.status === selectedStatus;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Sort logic
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'timestamp') {
      valA = new Date(a.timestamp).getTime();
      valB = new Date(b.timestamp).getTime();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: keyof Incident) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIncidents.length === sorted.length) {
      setSelectedIncidents([]);
    } else {
      setSelectedIncidents(sorted.map((i) => i.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedIncidents.includes(id)) {
      setSelectedIncidents(selectedIncidents.filter((x) => x !== id));
    } else {
      setSelectedIncidents([...selectedIncidents, id]);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Severity', 'Status', 'Asset', 'IP', 'MITRE', 'Confidence', 'Timestamp'];
    const rows = sorted.map((i) => [
      i.id,
      `"${i.title.replace(/"/g, '""')}"`,
      i.severity,
      i.status,
      i.asset.hostname,
      i.asset.ip,
      i.mitreTechnique.id,
      i.confidence,
      i.timestamp,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AEGIS-X_Incidents_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkContain = () => {
    selectedIncidents.forEach((id) => onUpdateIncidentStatus(id, 'CONTAINED'));
    setSelectedIncidents([]);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Live Incident Security Console
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Realtime Triage & Containment Operations Directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIncidents.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleBulkContain}>
              <Lock size={13} className="mr-1.5" />
              <span>Bulk Contain ({selectedIncidents.length})</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download size={13} className="mr-1.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-md font-mono text-xs">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-[#737373]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, asset, hostname, MITRE technique, or keyword..."
            className="w-full bg-white border border-[#E5E5E5] rounded pl-9 pr-3 py-1.5 text-xs text-[#111111] focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#737373]" />
          <span className="text-[#737373] hidden sm:inline">SEVERITY:</span>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded px-2 py-1.5 text-xs text-[#111111] focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <span className="text-[#737373] hidden sm:inline ml-2">STATUS:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded px-2 py-1.5 text-xs text-[#111111] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="TRIAGED">Triaged</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINMENT_PENDING">Containment Pending</option>
            <option value="CONTAINED">Contained</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5] font-mono text-[#737373] uppercase text-[10px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={sorted.length > 0 && selectedIncidents.length === sorted.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-[#E5E5E5]"
                  />
                </th>
                <th
                  onClick={() => toggleSort('id')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[#111111]"
                >
                  <div className="flex items-center gap-1">
                    <span>Incident ID</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold">Title & Threat Context</th>
                <th
                  onClick={() => toggleSort('severity')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[#111111]"
                >
                  <div className="flex items-center gap-1">
                    <span>Severity</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold">Target Asset</th>
                <th className="py-2.5 px-3 font-semibold">MITRE Technique</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th
                  onClick={() => toggleSort('confidence')}
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-[#111111]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Confidence</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5] font-mono">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-[#737373]">
                    No security incidents match the current filters.
                  </td>
                </tr>
              ) : (
                sorted.map((inc) => (
                  <tr
                    key={inc.id}
                    className="hover:bg-[#FAFAFA] transition-colors group"
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIncidents.includes(inc.id)}
                        onChange={() => handleToggleSelectOne(inc.id)}
                        className="rounded border-[#E5E5E5]"
                      />
                    </td>
                    <td
                      onClick={() => onNavigateView('incident-room', inc.id)}
                      className="py-3 px-3 font-bold text-[#111111] cursor-pointer hover:underline"
                    >
                      {inc.id}
                    </td>
                    <td
                      onClick={() => onNavigateView('incident-room', inc.id)}
                      className="py-3 px-3 font-sans max-w-[320px] cursor-pointer"
                    >
                      <div className="font-semibold text-[#111111] group-hover:underline">
                        {inc.title}
                      </div>
                      <div className="text-[11px] text-[#737373] truncate font-mono mt-0.5">
                        {inc.description}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge severity={inc.severity} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#111111]">{inc.asset.hostname}</div>
                      <div className="text-[10px] text-[#737373]">{inc.asset.ip}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="inline-block bg-[#F4F4F5] border border-[#E5E5E5] px-1.5 py-0.5 rounded text-[10px] text-[#111111]">
                        {inc.mitreTechnique.id}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge status={inc.status} />
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#111111]">
                      {inc.confidence}%
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onNavigateView('incident-room', inc.id)}
                      >
                        <span>Investigate</span>
                        <ExternalLink size={11} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center justify-between text-xs font-mono text-[#737373]">
          <div>
            Showing <span className="font-semibold text-[#111111]">{sorted.length}</span> of{' '}
            <span className="font-semibold text-[#111111]">{incidents.length}</span> incidents
          </div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  );
};
