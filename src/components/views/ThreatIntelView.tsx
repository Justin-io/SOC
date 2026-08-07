import React, { useState } from 'react';
import {
  Globe,
  Search,
  ShieldAlert,
  Database,
  ExternalLink,
  Lock,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { IOCItem } from '../../types/soc';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ThreatIntelViewProps {
  iocs: IOCItem[];
}

export const ThreatIntelView: React.FC<ThreatIntelViewProps> = ({ iocs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedIOC, setSelectedIOC] = useState<IOCItem>(iocs[0]);

  const filtered = iocs.filter((item) => {
    const matchesSearch =
      item.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.threatFamily && item.threatFamily.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = selectedType === 'ALL' || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            Threat Intelligence & IOC Explorer
          </h1>
          <p className="text-xs text-[#737373] font-mono mt-0.5">
            Cross-checking VirusTotal, AbuseIPDB, Shodan & MITRE ATT&CK Framework
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Globe size={16} className="text-blue-600" />
          <span className="font-bold text-[#111111]">{iocs.length} THREAT SIGNATURES LOADED</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-md font-mono text-xs">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-[#737373]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Query IP, Hash, Domain, URL, or Threat Family..."
            className="w-full bg-white border border-[#E5E5E5] rounded pl-9 pr-3 py-1.5 text-xs text-[#111111] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#737373]">TYPE:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white border border-[#E5E5E5] rounded px-2 py-1.5 text-xs text-[#111111] focus:outline-none"
          >
            <option value="ALL">All Indicator Types</option>
            <option value="IP">IP Address</option>
            <option value="HASH">File Hash</option>
            <option value="DOMAIN">Domain Name</option>
            <option value="URL">URL</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Left IOC List + Right Detailed Score Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: IOC Selector List (5 Cols) */}
        <div className="lg:col-span-5 space-y-2">
          {filtered.map((ioc) => (
            <Card
              key={ioc.value}
              onClick={() => setSelectedIOC(ioc)}
              hoverable
              className={`p-3 space-y-2 font-mono text-xs cursor-pointer transition-colors ${
                selectedIOC.value === ioc.value ? 'border-[#111111] bg-[#FAFAFA]' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#111111] text-xs truncate max-w-[240px]">
                  {ioc.value}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F4F5] border border-[#E5E5E5]">
                  {ioc.type}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#525252] font-sans">{ioc.threatFamily || 'Uncategorized'}</span>
                <span
                  className={`font-bold ${
                    ioc.reputation === 'MALICIOUS'
                      ? 'text-red-600'
                      : ioc.reputation === 'SUSPICIOUS'
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {ioc.reputation} ({ioc.confidence}%)
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Right: Comprehensive Threat Intel Inspection Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 space-y-4 font-mono text-xs">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-[#737373] bg-[#F4F4F5] px-1.5 py-0.5 rounded border border-[#E5E5E5]">
                    {selectedIOC.type}
                  </span>
                  <span className="font-bold text-red-600 text-xs">
                    REPUTATION: {selectedIOC.reputation}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#111111] mt-1 break-all">
                  {selectedIOC.value}
                </h2>
                <p className="text-xs font-sans text-[#525252] mt-0.5">
                  Threat Classification: {selectedIOC.threatFamily}
                </p>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-[#737373]">CONFIDENCE</div>
                <div className="text-xl font-bold text-red-600">{selectedIOC.confidence}%</div>
              </div>
            </div>

            {/* 3 API Integration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* VirusTotal */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded space-y-1">
                <div className="text-[10px] text-[#737373] font-bold">VIRUSTOTAL</div>
                <div className="text-base font-bold text-red-600">
                  {selectedIOC.virusTotal.scoreRatio}
                </div>
                <div className="text-[10px] text-[#525252]">
                  {selectedIOC.virusTotal.malicious} Malicious Detections
                </div>
              </div>

              {/* AbuseIPDB */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded space-y-1">
                <div className="text-[10px] text-[#737373] font-bold">ABUSEIPDB</div>
                <div className="text-base font-bold text-amber-600">
                  {selectedIOC.abuseIPDB.abuseConfidenceScore}% Score
                </div>
                <div className="text-[10px] text-[#525252]">
                  {selectedIOC.abuseIPDB.totalReports} Abuse Reports
                </div>
              </div>

              {/* Shodan */}
              <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded space-y-1">
                <div className="text-[10px] text-[#737373] font-bold">SHODAN</div>
                <div className="text-base font-bold text-[#111111]">
                  ISP: {selectedIOC.shodan.isp}
                </div>
                <div className="text-[10px] text-[#525252]">
                  Ports: {selectedIOC.shodan.ports.join(', ') || 'None'}
                </div>
              </div>
            </div>

            {/* MITRE Mapping & Incident Linkage */}
            <div className="space-y-2 border-t border-[#E5E5E5] pt-3">
              <div className="text-[10px] font-bold text-[#737373] uppercase">
                MITRE ATT&CK MAPPINGS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedIOC.mitreMapping.map((m) => (
                  <span
                    key={m}
                    className="bg-[#F4F4F5] border border-[#E5E5E5] px-2 py-0.5 rounded text-xs font-mono text-[#111111]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[#E5E5E5] pt-3 text-[11px] text-[#525252]">
              <div>
                <span className="text-[#737373] text-[10px]">HISTORICAL OBSERVATIONS:</span>
                <div className="font-bold text-[#111111]">{selectedIOC.historicalObservations} times</div>
              </div>
              <div>
                <span className="text-[#737373] text-[10px]">RELATED INCIDENTS:</span>
                <div className="font-bold text-red-600">{selectedIOC.relatedIncidentsCount} incidents</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
