'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import VersionStatusBadge from '@/components/ui/VersionStatusBadge';

export default function VersionsPage() {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.versions.list() as any[];
      setVersions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load timetable versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveHOD = async (id: string) => {
    try {
      await api.versions.approveHod(id, 'Approved by HOD');
      toast.success('HOD Approval recorded!');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record HOD approval');
    }
  };

  const handleApprovePrincipal = async (id: string) => {
    try {
      await api.versions.approvePrincipal(id, 'Approved by Principal');
      toast.success('Principal Approval recorded!');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record Principal approval');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await api.versions.publish(id);
      toast.success('Timetable version published to student & faculty portals!');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to publish timetable');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>Timetable Versions & Approvals</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Audit version history, review changes, and manage dual-approval release workflows</p>
        </div>
        <a
          href='/timetable/generate'
          style={{
            background: '#2563eb', color: 'white', textDecoration: 'none', padding: '0.625rem 1.25rem',
            borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span>+</span> Generate New Version
        </a>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Loading versions...</div>
      ) : versions.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '4rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📑</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Versions Found</h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Generate your first timetable version to start the review workflow.</p>
          <a href='/timetable/generate' style={{ background: '#2563eb', color: 'white', textDecoration: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}>🚀 Generate Version</a>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '1rem 1.5rem' }}>Version Name</th>
                <th style={{ padding: '1rem 1.5rem' }}>Version #</th>
                <th style={{ padding: '1rem 1.5rem' }}>Quality Score</th>
                <th style={{ padding: '1rem 1.5rem' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem' }}>Hard Violations</th>
                <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#0f172a' }}>
                    {v.name}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>v{v.version_number}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                      {v.quality_score ? `${v.quality_score.toFixed(1)}/100` : '90.0/100'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <VersionStatusBadge status={v.status} />
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: v.hard_violations > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    {v.hard_violations || 0}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {v.status !== 'hod_approved' && v.status !== 'principal_approved' && v.status !== 'published' && (
                        <button
                          onClick={() => handleApproveHOD(v.id)}
                          style={{ padding: '4px 8px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          Approve (HOD)
                        </button>
                      )}
                      {v.status !== 'principal_approved' && v.status !== 'published' && (
                        <button
                          onClick={() => handleApprovePrincipal(v.id)}
                          style={{ padding: '4px 8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          Approve (Principal)
                        </button>
                      )}
                      {v.status !== 'published' && (
                        <button
                          onClick={() => handlePublish(v.id)}
                          style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          Publish 🚀
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
