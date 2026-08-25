import React from 'react';

interface ApprovalTimelineProps {
  status: string; // 'draft' | 'generated' | 'reviewed' | 'hod_approved' | 'principal_approved' | 'published' | 'locked'
  history: any[]; // Array of history items containing timestamp and user name
}

const steps = [
  { id: 'generated', label: 'Generated' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'hod_approved', label: 'HOD Approved' },
  { id: 'principal_approved', label: 'Principal Approved' },
  { id: 'published', label: 'Published' },
  { id: 'locked', label: 'Locked' }
];

export default function ApprovalTimeline({ status, history }: ApprovalTimelineProps) {
  const currentIndex = steps.findIndex(s => s.id === status) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* Track Line */}
        <div style={{ position: 'absolute', top: '16px', left: '0', right: '0', height: '2px', background: '#e2e8f0', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '16px', left: '0', width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%`, height: '2px', background: '#3b82f6', zIndex: 0, transition: 'width 0.3s ease' }} />

        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const historyItem = history?.find(h => h.status === step.id);

          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '120px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: isCompleted ? '#3b82f6' : 'white',
                border: `2px solid ${isCompleted ? '#3b82f6' : '#cbd5e1'}`,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: isCompleted ? 'white' : '#cbd5e1',
                marginBottom: '8px',
                boxShadow: isCurrent ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : 'none',
              }}>
                {isCompleted ? '✓' : (index + 1)}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: isCurrent ? '600' : '500', color: isCompleted ? '#0f172a' : '#64748b' }}>
                  {step.label}
                </div>
                {historyItem && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    <div>{historyItem.user}</div>
                    <div>{new Date(historyItem.timestamp).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
