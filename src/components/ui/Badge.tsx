import React from 'react';
import { Severity, IncidentStatus, AgentStatus } from '../../types/soc';

interface BadgeProps {
  children?: React.ReactNode;
  severity?: Severity;
  status?: IncidentStatus | AgentStatus;
  variant?: 'outline' | 'solid' | 'subtle';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  severity,
  status,
  variant = 'subtle',
  className = '',
}) => {
  let colorStyle = 'bg-zinc-100 text-zinc-800 border-zinc-200';

  if (severity === 'CRITICAL') {
    colorStyle = 'bg-red-50 text-red-700 border-red-200 font-semibold';
  } else if (severity === 'HIGH') {
    colorStyle = 'bg-amber-50 text-amber-700 border-amber-200 font-medium';
  } else if (severity === 'MEDIUM') {
    colorStyle = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (severity === 'LOW') {
    colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (severity === 'INFO') {
    colorStyle = 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }

  if (status) {
    if (status === 'NEW' || status === 'OFFLINE') {
      colorStyle = 'bg-red-50 text-red-700 border-red-200';
    } else if (status === 'INVESTIGATING' || status === 'ANALYZING' || status === 'EXECUTING') {
      colorStyle = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (status === 'CONTAINMENT_PENDING' || status === 'DEGRADED') {
      colorStyle = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (status === 'CONTAINED' || status === 'RESOLVED' || status === 'IDLE') {
      colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (status === 'FALSE_POSITIVE') {
      colorStyle = 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border whitespace-nowrap ${colorStyle} ${className}`}
    >
      {children || severity || status}
    </span>
  );
};
