'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const [clsList, facList] = await Promise.all([
        api.classes.list() as Promise<any[]>,
        api.faculty.list() as Promise<any[]>,
      ]);
      setClasses(clsList || []);
      setFaculty(facList || []);
    }
    load();
  }, []);

  const handleDownload = (type: string, name: string) => {
    toast.success(`Preparing ${type} export for ${name}...`);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>Reports & Analytics Export</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Download official academic timetables, faculty teaching workload reports, and classroom usage statistics</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Class Timetables */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>Class Timetable Exports</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Export formatted Excel sheets and printable PDFs for each class cohort.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {classes.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleDownload('Excel', c.name)} style={{ padding: '4px 8px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Excel</button>
                  <button onClick={() => handleDownload('PDF', c.name)} style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>PDF</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Faculty Workload */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>👨‍🏫</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>Faculty Teaching Schedules</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Individual schedule breakdown and weekly contact hours.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {faculty.slice(0, 5).map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.name}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleDownload('Schedule', f.name)} style={{ padding: '4px 8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Export</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department Workload Summary */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📈</div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>Department Workload Audit</h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Full institutional audit report of teaching loads and room occupancy.</p>
          <button
            onClick={() => handleDownload('Institutional Audit', 'Apex Institute')}
            style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Download Institutional Summary (.xlsx)
          </button>
        </div>
      </div>
    </div>
  );
}
