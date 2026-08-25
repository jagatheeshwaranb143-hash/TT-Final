import React from 'react';

interface Conflict {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface ConflictReportProps {
  conflicts?: Conflict[];
}

export default function ConflictReport({ conflicts = [] }: ConflictReportProps) {
  if (conflicts.length === 0) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface)', border: 'none', boxShadow: 'none' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          background: 'var(--color-success-bg)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginBottom: 'var(--space-4)',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
        }}>
          <span style={{ fontSize: '2.5rem', color: 'var(--color-success)' }}>✓</span>
        </div>
        <h3 style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>No Conflicts</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', maxWidth: '200px' }}>
          This timetable is perfectly aligned. All constraints are satisfied.
        </p>
      </div>
    );
  }

  const errors = conflicts.filter(c => c.type === 'error');
  const warnings = conflicts.filter(c => c.type === 'warning');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        borderBottom: '1px solid var(--color-border)', 
        paddingBottom: 'var(--space-4)', 
        marginBottom: 'var(--space-4)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: 'var(--font-size-lg)', margin: 0 }}>
          Conflict Report
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {errors.length > 0 && <span className="badge badge-error">{errors.length} Errors</span>}
          {warnings.length > 0 && <span className="badge badge-warning">{warnings.length} Warns</span>}
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingRight: 'var(--space-2)' }}>
        {conflicts.map(conflict => (
          <div key={conflict.id} style={{
            background: conflict.type === 'error' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
            border: `1px solid ${conflict.type === 'error' ? '#fca5a5' : '#fcd34d'}`,
            borderLeft: `4px solid ${conflict.type === 'error' ? 'var(--color-error)' : 'var(--color-warning)'}`,
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform var(--transition-fast)',
            cursor: 'default'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(0)'}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 'var(--space-3)' 
            }}>
              <span style={{ 
                color: conflict.type === 'error' ? 'var(--color-error)' : 'var(--color-warning)',
                fontSize: '1.2rem',
                lineHeight: 1
              }}>
                {conflict.type === 'error' ? '⛔' : '⚠️'}
              </span>
              <div>
                <div style={{ 
                  fontWeight: 600, 
                  color: conflict.type === 'error' ? '#991b1b' : '#92400e',
                  marginBottom: 'var(--space-1)',
                  fontSize: 'var(--font-size-sm)'
                }}>
                  {conflict.message}
                </div>
                {conflict.details && (
                  <div style={{ 
                    fontSize: 'var(--font-size-xs)', 
                    color: conflict.type === 'error' ? '#b91c1c' : '#b45309',
                    opacity: 0.9,
                    lineHeight: 1.4
                  }}>
                    {conflict.details}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
