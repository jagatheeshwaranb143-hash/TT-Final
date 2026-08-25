'use client';
import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([
    { id: '1', name: 'System Administrator', email: 'admin@smartschedule.dev', role: 'super_admin', status: 'Active' },
    { id: '2', name: 'Head of Department', email: 'hod@smartschedule.dev', role: 'hod', status: 'Active' },
    { id: '3', name: 'Dr. Demo Faculty', email: 'faculty@smartschedule.dev', role: 'faculty', status: 'Active' },
  ]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>User & Access Management</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Manage role-based permissions, administrative accounts, and staff credentials</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
              <th style={{ padding: '1rem 1.5rem' }}>User</th>
              <th style={{ padding: '1rem 1.5rem' }}>Email Address</th>
              <th style={{ padding: '1rem 1.5rem' }}>Role</th>
              <th style={{ padding: '1rem 1.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#0f172a' }}>{u.name}</td>
                <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{u.email}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ background: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.75rem' }}>
                    {u.status}
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
