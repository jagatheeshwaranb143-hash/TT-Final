import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon = '📁', action }: EmptyStateProps) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '4rem 2rem',
      textAlign: 'center',
      border: '1px dashed var(--color-border)',
      borderRadius: 'var(--border-radius-card)',
      backgroundColor: 'var(--color-surface)'
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>{icon}</div>
      <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', maxWidth: '400px' }}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
