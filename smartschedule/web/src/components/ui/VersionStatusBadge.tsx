import React from 'react';

interface VersionStatusBadgeProps {
  status: string;
}

export default function VersionStatusBadge({ status }: VersionStatusBadgeProps) {
  const getBadgeStyle = () => {
    switch (status) {
      case 'draft': return { bg: '#f1f5f9', color: '#64748b', label: 'Draft' };
      case 'generated': return { bg: '#e0f2fe', color: '#0284c7', label: 'Generated' };
      case 'reviewed': return { bg: '#ccfbf1', color: '#0f766e', label: 'Reviewed' };
      case 'hod_approved': return { bg: '#dcfce3', color: '#15803d', label: 'HOD Approved' };
      case 'principal_approved': return { bg: '#fef3c7', color: '#b45309', label: 'Principal Approved' };
      case 'published': return { bg: '#d1fae5', color: '#047857', label: 'Published ✓' };
      case 'locked': return { bg: '#334155', color: '#f8fafc', label: 'Locked 🔒' };
      case 'archived': return { bg: '#e2e8f0', color: '#475569', label: 'Archived' };
      default: return { bg: '#f1f5f9', color: '#64748b', label: status };
    }
  };

  const style = getBadgeStyle();

  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      padding: '4px 8px', 
      borderRadius: '9999px', 
      fontSize: '12px', 
      fontWeight: '500',
      background: style.bg,
      color: style.color
    }}>
      {style.label}
    </span>
  );
}
