import os

base_dir = r"c:\Users\kisho\OneDrive\Desktop\TIMETABLEAI\smartschedule\web"

files = {
    "src/app/setup/page.tsx": """'use client';
import { useState } from 'react';

export default function SetupPage() {
  const steps = [
    'College Info', 'Academic Year', 'Departments', 'Programs', 'Classes',
    'Faculty', 'Subjects', 'Rooms', 'Labs', 'Working Days', 'Periods', 'Constraints', 'Generate'
  ];
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="dashboard-layout">
      <div style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 className="page-title" style={{ marginBottom: '2rem' }}>System Setup Wizard</h1>
        
        <div className="stepper" style={{ marginBottom: '3rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {steps.map((step, idx) => (
            <div key={idx} className="step-item">
              <div className={`step-circle ${idx < currentStep ? 'complete' : idx === currentStep ? 'current' : 'pending'}`}>
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <div className="step-label">{step}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="section-title">Step {currentStep + 1}: {steps[currentStep]}</h2>
          <div className="empty-state">
            <p>Setup form for {steps[currentStep]} will be displayed here.</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary" disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)}>Previous</button>
            <button className="btn btn-primary" onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}>
              {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next Step'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/departments/page.tsx": """'use client';
export default function DepartmentsPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Departments</h1>
          <button className="btn btn-primary">+ Add Department</button>
        </header>
        <div className="page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🏢</div>
              <div className="empty-state-title">No Departments Added</div>
              <div className="empty-state-desc">Get started by creating your first department.</div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }}>+ Add Department</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/faculty/page.tsx": """'use client';
export default function FacultyPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Faculty</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary">Import from Excel</button>
            <button className="btn btn-primary">+ Add Faculty</button>
          </div>
        </header>
        <div className="page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🧑‍🏫</div>
              <div className="empty-state-title">No Faculty Added</div>
              <div className="empty-state-desc">Add faculty members manually or import them from an Excel file.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/subjects/page.tsx": """'use client';
export default function SubjectsPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Subjects</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary">Import from Excel</button>
            <button className="btn btn-primary">+ Add Subject</button>
          </div>
        </header>
        <div className="page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <div className="empty-state-title">No Subjects Added</div>
              <div className="empty-state-desc">Add subjects manually or import them from an Excel file.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/rooms/page.tsx": """'use client';
export default function RoomsPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Rooms</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary">Import from Excel</button>
            <button className="btn btn-primary">+ Add Room</button>
          </div>
        </header>
        <div className="page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🚪</div>
              <div className="empty-state-title">No Rooms Added</div>
              <div className="empty-state-desc">Add rooms manually or import them from an Excel file.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/laboratories/page.tsx": """'use client';
export default function LaboratoriesPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Laboratories</h1>
          <button className="btn btn-primary">+ Add Lab</button>
        </header>
        <div className="page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🔬</div>
              <div className="empty-state-title">No Laboratories Added</div>
              <div className="empty-state-desc">Create laboratory spaces for practical sessions.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/import/page.tsx": """'use client';
export default function ImportPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Data Import</h1>
        </header>
        <div className="page-content">
          <div className="card">
            <h2 className="section-title">Import Data from Excel</h2>
            <div className="empty-state" style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <div className="empty-state-icon">📁</div>
              <div className="empty-state-title">Drag and drop file here</div>
              <div className="empty-state-desc">Supports .xlsx and .csv formats</div>
              <button className="btn btn-secondary" style={{ marginTop: '1rem' }}>Browse Files</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/app/periods/page.tsx": """'use client';
export default function PeriodsPage() {
  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Period Configuration</h1>
          <button className="btn btn-primary">Save Configuration</button>
        </header>
        <div className="page-content">
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">⏱️</div>
              <div className="empty-state-title">No Periods Configured</div>
              <div className="empty-state-desc">Define your working days and period times.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}""",

    "src/components/ui/Modal.tsx": """import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!isOpen) return null;
  
  const sizes = { sm: '300px', md: '500px', lg: '800px', xl: '1140px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: sizes[size], maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>&times;</button>
        </div>
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}""",

    "src/components/ui/DataTable.tsx": """import React from 'react';

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, isLoading, emptyMessage = 'No data available' }: DataTableProps<T>) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, i) => <th key={i}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={i}>
                {columns.map((col, j) => {
                  const val = (row as any)[col.key as string];
                  return <td key={j}>{col.render ? col.render(val, row) : val}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}""",

    "src/components/ui/ConfirmDialog.tsx": """import React from 'react';
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
}""",

    "src/components/ui/ImportModal.tsx": """import React from 'react';
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
}""",

    "src/components/timetable/TimetableGrid.tsx": """import React from 'react';

export function TimetableGrid() {
  return (
    <div className="timetable-grid">
      <div className="empty-state" style={{ padding: '3rem' }}>
        <p>Timetable view will be rendered here.</p>
      </div>
    </div>
  );
}"""
}

for path, content in files.items():
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Remaining files generated.")
