'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function PeriodsPage() {
  const [workingDays, setWorkingDays] = useState([
    { day: 1, name: 'Monday', active: true },
    { day: 2, name: 'Tuesday', active: true },
    { day: 3, name: 'Wednesday', active: true },
    { day: 4, name: 'Thursday', active: true },
    { day: 5, name: 'Friday', active: true },
    { day: 6, name: 'Saturday', active: false },
  ]);

  const [periods, setPeriods] = useState([
    { number: 1, label: 'Period 1', start: '09:00', end: '10:00', is_break: false },
    { number: 2, label: 'Period 2', start: '10:00', end: '11:00', is_break: false },
    { number: 0, label: 'Short Break', start: '11:00', end: '11:15', is_break: true },
    { number: 3, label: 'Period 3', start: '11:15', end: '12:15', is_break: false },
    { number: 4, label: 'Period 4', start: '12:15', end: '13:15', is_break: false },
    { number: 0, label: 'Lunch Break', start: '13:15', end: '14:00', is_break: true },
    { number: 5, label: 'Period 5', start: '14:00', end: '15:00', is_break: false },
    { number: 6, label: 'Period 6', start: '15:00', end: '16:00', is_break: false },
  ]);

  const [saving, setSaving] = useState(false);

  const handleToggleDay = (dayIndex: number) => {
    setWorkingDays(prev => prev.map((d, i) => i === dayIndex ? { ...d, active: !d.active } : d));
  };

  const [userCollegeId, setUserCollegeId] = useState<string>('c1111111-1111-1111-1111-111111111111');

  useEffect(() => {
    async function loadConfig() {
      try {
        const res: any = await api.periods.workingDays();
        if (res && res.working_days && Array.isArray(res.working_days)) {
          const activeDays = res.working_days;
          setWorkingDays(prev => prev.map(d => ({ ...d, active: activeDays.includes(d.day) })));
        }
        if (res && res.college_id) {
          setUserCollegeId(res.college_id);
        }
      } catch (e) {
        console.error('Failed to load working days config', e);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const activeDays = workingDays.filter(d => d.active).map(d => d.day);
      await api.periods.setWorkingDays({
        college_id: userCollegeId,
        working_days: activeDays,
      });
      toast.success('Period configurations saved successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save period configurations');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a' }}>Period Configuration & Bell Schedule</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Set institutional working days, teaching period durations, and break intervals</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: '#2563eb', color: 'white', border: 'none', padding: '0.625rem 1.5rem',
            borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Working Days */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.75rem', border: '1px solid #e2e8f0', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>Weekly Working Days</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Select which days classes will be scheduled by the solver:</p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {workingDays.map((d, idx) => (
            <button
              key={d.day}
              type='button'
              onClick={() => handleToggleDay(idx)}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                border: d.active ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: d.active ? '#eff6ff' : '#f8fafc',
                color: d.active ? '#1d4ed8' : '#64748b',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{d.active ? '✓' : '○'}</span> {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Period Schedule */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>Daily Periods & Breaks</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>6 Teaching Periods + Morning Interval + Lunch Break:</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {periods.map((p, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderRadius: '8px',
                background: p.is_break ? '#fef3c7' : '#f8fafc',
                border: p.is_break ? '1px solid #fcd34d' : '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontWeight: 700, color: p.is_break ? '#b45309' : '#0f172a', width: '120px' }}>
                  {p.is_break ? `☕ ${p.label}` : `⏱️ ${p.label}`}
                </span>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {p.start} — {p.end}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: p.is_break ? '#b45309' : '#059669' }}>
                {p.is_break ? 'Recess / Interval' : 'Teaching Slot (60 min)'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
