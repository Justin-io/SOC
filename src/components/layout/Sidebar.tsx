import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  GitBranch,
  Bot,
  Globe,
  Network,
  Cpu,
  Clock,
  FileCheck2,
  BarChart3,
  FlaskConical,
  FileText,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

export type ViewType =
  | 'dashboard'
  | 'incidents'
  | 'incident-room'
  | 'agent-observatory'
  | 'threat-intel'
  | 'threat-graph'
  | 'digital-twin'
  | 'chronon'
  | 'audit-trail'
  | 'analytics'
  | 'benchmark'
  | 'reports'
  | 'administration';

interface SidebarProps {
  currentView?: ViewType;
  activeView?: ViewType;
  onSelectView?: (view: ViewType) => void;
  onNavigateView?: (view: ViewType) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  criticalIncidentsCount?: number;
  activeIncidentsCount?: number;
  activeIncidentCount?: number;
  activeAgentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeView,
  onSelectView,
  onNavigateView,
  collapsed: externalCollapsed,
  onToggleCollapse,
  criticalIncidentsCount = 0,
  activeIncidentsCount,
  activeIncidentCount = 0,
}) => {
  const [internalCollapsed, setInternalCollapsed] = React.useState(false);
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const selectedView = activeView || currentView || 'dashboard';
  const handleSelect = (view: ViewType) => {
    if (onNavigateView) onNavigateView(view);
    if (onSelectView) onSelectView(view);
  };

  const countActive = activeIncidentsCount !== undefined ? activeIncidentsCount : activeIncidentCount;

  const navItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'incidents' as ViewType,
      label: 'Live Incidents',
      icon: ShieldAlert,
      badge: countActive > 0 ? countActive : undefined,
      badgeCritical: criticalIncidentsCount > 0,
    },
    { id: 'incident-room' as ViewType, label: 'Incident Room', icon: GitBranch },
    { id: 'agent-observatory' as ViewType, label: 'Agent Observatory', icon: Bot },
    { id: 'threat-intel' as ViewType, label: 'Threat Intelligence', icon: Globe },
    { id: 'threat-graph' as ViewType, label: 'Threat Graph', icon: Network },
    { id: 'digital-twin' as ViewType, label: 'Digital Twin', icon: Cpu },
    { id: 'chronon' as ViewType, label: 'Chronon Visualization', icon: Clock },
    { id: 'audit-trail' as ViewType, label: 'Audit Trail', icon: FileCheck2 },
    { id: 'analytics' as ViewType, label: 'Analytics', icon: BarChart3 },
    { id: 'benchmark' as ViewType, label: 'Benchmark', icon: FlaskConical },
    { id: 'reports' as ViewType, label: 'Reports', icon: FileText },
    { id: 'administration' as ViewType, label: 'Administration', icon: Sliders },
  ];

  return (
    <aside
      className={`bg-[#FFFFFF] border-r border-[#E5E5E5] flex flex-col justify-between transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header Logo */}
      <div>
        <div className="h-14 border-b border-[#E5E5E5] flex items-center justify-between px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded bg-[#111111] text-white flex items-center justify-center shrink-0 font-bold tracking-tighter text-sm">
              AX
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm tracking-tight text-[#111111] truncate">
                  AEGIS-X
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#737373] font-mono">
                  Autonomous SOC
                </span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="p-1 rounded text-[#737373] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = selectedView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded text-xs font-medium transition-colors relative group ${
                  isActive
                    ? 'bg-[#111111] text-white font-semibold'
                    : 'text-[#525252] hover:text-[#111111] hover:bg-[#F5F5F5]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-[#737373]'} />
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {item.badge !== undefined && (
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      item.badgeCritical
                        ? 'bg-red-600 text-white'
                        : isActive
                        ? 'bg-zinc-800 text-white'
                        : 'bg-[#E5E5E5] text-[#111111]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Details */}
      <div className="p-3 border-t border-[#E5E5E5] text-[11px] font-mono text-[#737373]">
        {!isCollapsed ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>SYSTEM ENGINE</span>
              <span className="text-emerald-600 font-semibold">ONLINE</span>
            </div>
            <div className="text-[10px] text-[#A1A1AA]">v4.12.0-ENTERPRISE</div>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="System Online" />
          </div>
        )}
      </div>
    </aside>
  );
};
