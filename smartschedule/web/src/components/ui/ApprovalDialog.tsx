import React, { useState } from 'react';

interface ApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'approve' | 'reject' | 'publish';
}

export default function ApprovalDialog({ isOpen, onClose, onConfirm, title, description, confirmLabel = 'Confirm', variant = 'approve' }: ApprovalDialogProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (variant === 'reject' && !notes.trim()) {
      setError('Please provide a reason.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      await onConfirm(notes);
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getButtonColor = () => {
    if (variant === 'reject') return '#ef4444';
    if (variant === 'publish') return '#3b82f6';
    return '#10b981';
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '400px', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>{title}</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>{description}</p>
        
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes (optional)..."
          rows={3}
          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '16px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
        />

        {error && <div style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={loading}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: getButtonColor(), color: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Confirming...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
