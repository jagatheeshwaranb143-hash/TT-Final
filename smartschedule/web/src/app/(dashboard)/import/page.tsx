'use client';
import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function ImportPage() {
  const [entityType, setEntityType] = useState('faculty');
  const [dragging, setDragging] = useState(false);

  const handleUpload = () => {
    toast.success(`Data imported for ${entityType}!`);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Bulk Data Import</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' }}>
        Import faculty rosters, subject catalogs, and room inventories using standard Excel templates
      </p>

      <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Select Data Category</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600 }}
          >
            <option value='faculty'>Faculty & Teachers</option>
            <option value='subjects'>Courses & Subjects</option>
            <option value='rooms'>Rooms & Lecture Halls</option>
            <option value='classes'>Classes & Batches</option>
          </select>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleUpload(); }}
          style={{
            border: dragging ? '2px dashed #2563eb' : '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
            background: dragging ? '#eff6ff' : '#f8fafc',
            cursor: 'pointer',
            marginBottom: '1.5rem'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📁</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>Drag and drop your spreadsheet here</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>Supports .xlsx and .csv formats</p>
          <button
            onClick={handleUpload}
            style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
          >
            Browse File
          </button>
        </div>
      </div>
    </div>
  );
}
