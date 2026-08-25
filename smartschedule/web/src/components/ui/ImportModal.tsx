import React from 'react';
import { Modal } from './Modal';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function ImportModal({ isOpen, onClose, title }: ImportModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    }>
      <div className="empty-state" style={{ border: '2px dashed var(--color-border)' }}>
        <p>Drop file here to upload</p>
      </div>
    </Modal>
  );
}
