import React from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isDestructive = true }: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" footer={
      <>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
      </>
    }>
      <p style={{ color: 'var(--color-text)' }}>{message}</p>
    </Modal>
  );
}
