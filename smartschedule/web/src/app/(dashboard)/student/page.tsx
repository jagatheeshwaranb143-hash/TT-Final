'use client';
import { useAuth } from '@/lib/auth-context';

export default function StudentDashboard() {
  const { user } = useAuth();
  
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Welcome, {user?.full_name || 'Student'}</h1>
        <p className="page-subtitle">{today}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary)' }}>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>Current Class</h3>
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>No class in session right now.</p>
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Next Class</h3>
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>No upcoming classes today.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <h2 className="section-title">Weekly Timetable</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">Timetable Not Available</div>
          <div className="empty-state-desc">Your department has not published the timetable yet.</div>
        </div>
      </div>
    </div>
  );
}
