'use client';
import React from 'react';

export default function AuditPage() {
  const auditLogs = [
    { id: '1', action: 'TIMETABLE_GENERATED', actor: 'System Admin', target: 'Fall 2026 Master Timetable', time: 'Today at 14:24', status: 'SUCCESS' },
    { id: '2', action: 'FACULTY_CREATED', actor: 'System Admin', target: 'Dr. Alan Turing (TURING)', time: 'Today at 14:24', status: 'SUCCESS' },
    { id: '3', action: 'ROOM_CREATED', actor: 'System Admin', target: 'Room 101 (Capacity 60)', time: 'Today at 14:24', status: 'SUCCESS' },
    { id: '4', action: 'USER_LOGIN', actor: 'admin@smartschedule.dev', target: 'Web Session', time: 'Today at 14:20', status: 'SUCCESS' },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>System Audit Trail</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' }}>Comprehensive security log of administrative changes, approvals, and data mutations</p>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
              <th style={{ padding: '1rem 1.5rem' }}>Action</th>
              <th style={{ padding: '1rem 1.5rem' }}>Actor</th>
              <th style={{ padding: '1rem 1.5rem' }}>Target Resource</th>
              <th style={{ padding: '1rem 1.5rem' }}>Timestamp</th>
              <th style={{ padding: '1rem 1.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: '#2563eb' }}>{log.action}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#0f172a' }}>{log.actor}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{log.target}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{log.time}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
