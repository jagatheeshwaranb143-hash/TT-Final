'use client';
import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Master Timetable Generated', desc: 'AI CP-SAT solver successfully scheduled 42 class periods with 90.0 quality score.', time: '10 mins ago', unread: true },
    { id: '2', title: 'HOD Approval Requested', desc: 'Fall 2026 timetable version is ready for HOD review and sign-off.', time: '1 hour ago', unread: true },
    { id: '3', title: 'Room Allocation Updated', desc: 'CS301 has been assigned to Room 101 for Monday & Wednesday.', time: '2 hours ago', unread: false },
  ]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    toast.success('All notifications marked as read');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>System Notifications</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Stay updated on timetable approvals, schedule changes, and conflict alerts</p>
        </div>
        <button
          onClick={markAllRead}
          style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Mark all as read
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.25rem',
              border: '1px solid #e2e8f0',
              borderLeft: n.unread ? '4px solid #2563eb' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{n.title}</h3>
                {n.unread && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span>}
              </div>
              <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>{n.desc}</p>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
