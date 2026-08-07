import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Severity } from '../../types/soc';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  severity: Severity;
  read: boolean;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onNotificationClick: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearAll,
  onNotificationClick,
}) => {
  if (!isOpen) return null;

  const getIcon = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL':
        return <ShieldAlert size={16} className="text-red-600 shrink-0" />;
      case 'HIGH':
        return <AlertTriangle size={16} className="text-amber-600 shrink-0" />;
      case 'MEDIUM':
        return <AlertTriangle size={16} className="text-blue-600 shrink-0" />;
      case 'LOW':
        return <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
      default:
        return <Info size={16} className="text-zinc-600 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs flex justify-end">
      <div className="bg-white border-l border-[#E5E5E5] w-full max-w-md h-full flex flex-col shadow-xl font-sans">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-[#111111]">SOC Notification Bus</h3>
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-[#111111] font-mono text-xs">
              {notifications.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearAll}
              className="p-1 text-[#737373] hover:text-[#111111] rounded hover:bg-[#F5F5F5] transition-colors"
              title="Clear All Notifications"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-[#737373] hover:text-[#111111] rounded hover:bg-[#F5F5F5] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-b border-[#E5E5E5] bg-[#FAFAFA] flex justify-between text-xs font-mono">
            <button
              onClick={onMarkAllRead}
              className="text-[#525252] hover:text-[#111111] font-medium"
            >
              Mark all as read
            </button>
            <span className="text-[#737373]">AEGIS-X Realtime Bus</span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-xs font-mono text-[#737373]">
              No active notifications
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onNotificationClick(n.id)}
                className={`p-3 rounded border text-xs cursor-pointer transition-colors ${
                  n.read
                    ? 'bg-white border-[#E5E5E5] text-[#525252]'
                    : 'bg-[#FAFAFA] border-[#111111]/20 font-medium text-[#111111]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {getIcon(n.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#111111] truncate">{n.title}</span>
                      <span className="font-mono text-[10px] text-[#737373] shrink-0">
                        {n.timestamp}
                      </span>
                    </div>
                    <p className="mt-1 text-[#525252] leading-relaxed text-[11px] line-clamp-2 font-sans">
                      {n.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
