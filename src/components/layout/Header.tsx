import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Wifi,
  WifiOff,
  Bot,
  User,
  ChevronDown,
  Building2,
  AlertTriangle,
  RefreshCw,
  PanelLeft,
} from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  realtimeConnected: boolean;
  agentHealthPercent: number;
  activeWorkspace: string;
  onChangeWorkspace: (ws: string) => void;
  onRefreshData?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount,
  realtimeConnected,
  agentHealthPercent,
  activeWorkspace,
  onChangeWorkspace,
  onRefreshData,
  onToggleSidebar,
}) => {
  const [timeString, setTimeString] = useState<string>('');
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const workspaces = [
    'GLOBAL SOC - PROD NORTH AMERICA',
    'EMEA SEC OPERATIONS - FRANKFURT',
    'APAC INTELLIGENCE HUB - SINGAPORE',
    'SANDBOX & DECEPTION SIMULATOR',
  ];

  return (
    <header className="flex flex-col bg-[#FFFFFF] border-b border-[#E5E5E5] z-20 sticky top-0">
      {/* Realtime Disconnection Banner (non-blocking) */}
      {!realtimeConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-amber-900 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span className="font-semibold">Realtime Connection Lost</span>
            <span className="text-amber-700 hidden sm:inline">
              — Operating on buffered telemetry state. Retrying backend WebSocket stream...
            </span>
          </div>
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-sans transition-colors"
            >
              <RefreshCw size={12} />
              <span>Reconnect</span>
            </button>
          )}
        </div>
      )}

      {/* Main Top Header Bar */}
      <div className="h-14 px-4 flex items-center justify-between gap-4 text-xs">
        {/* Left Workspace Selector & Toggle */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-[#F5F5F5] text-[#525252] hover:text-[#111111] transition-colors"
              title="Toggle Navigation Sidebar"
            >
              <PanelLeft size={15} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-[#F5F5F5] font-mono font-medium text-[#111111] transition-colors"
            >
              <Building2 size={14} className="text-[#737373]" />
              <span className="max-w-[180px] sm:max-w-[240px] truncate">{activeWorkspace}</span>
              <ChevronDown size={14} className="text-[#737373]" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-[#E5E5E5] rounded-md shadow-lg py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] uppercase font-mono text-[#737373] border-b border-[#E5E5E5]">
                  Select Operational Region
                </div>
                {workspaces.map((ws) => (
                  <button
                    key={ws}
                    onClick={() => {
                      onChangeWorkspace(ws);
                      setShowWorkspaceMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                      activeWorkspace === ws
                        ? 'bg-[#111111] text-white font-semibold'
                        : 'text-[#525252] hover:bg-[#F5F5F5] hover:text-[#111111]'
                    }`}
                  >
                    {ws}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-[#F5F5F5] text-[#737373] hover:text-[#111111] transition-colors font-mono w-64"
          >
            <Search size={14} />
            <span className="flex-1 text-left truncate">Search incidents, assets, IOCs...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#E5E5E5] text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Status Indicators & Tools */}
        <div className="flex items-center gap-4 font-mono">
          {/* Agent Health summary */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#E5E5E5] bg-[#FAFAFA]">
            <Bot size={14} className="text-[#737373]" />
            <span className="text-[#525252]">AGENTS:</span>
            <span className="font-semibold text-emerald-600">{agentHealthPercent}%</span>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#E5E5E5] bg-[#FAFAFA]">
            {realtimeConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Wifi size={13} className="text-emerald-600" />
                <span className="text-[#111111] font-semibold text-[11px] hidden sm:inline">LIVE</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <WifiOff size={13} className="text-amber-600" />
                <span className="text-amber-600 font-semibold text-[11px] hidden sm:inline">OFFLINE</span>
              </>
            )}
          </div>

          {/* Clock */}
          <div className="hidden xl:block text-[#525252] text-[11px] font-mono">
            {timeString}
          </div>

          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded border border-[#E5E5E5] bg-[#FAFAFA] hover:bg-[#F5F5F5] text-[#525252] hover:text-[#111111] transition-colors"
            title="Notifications"
          >
            <Bell size={15} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#E5E5E5]">
            <div className="w-7 h-7 rounded bg-[#111111] text-white flex items-center justify-center font-bold text-xs">
              <User size={14} />
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="font-semibold text-xs text-[#111111] leading-tight">
                Sarah Chen
              </span>
              <span className="text-[10px] text-[#737373]">Lead SOC Operator</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
