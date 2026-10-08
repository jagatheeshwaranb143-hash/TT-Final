'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { getTimetablePreferences } from '@/lib/preferences';
import { exportTimetablePdf } from '@/lib/timetable-pdf';

const DAY_NAMES: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

export default function LabTimetablePage() {
  const searchParams = useSearchParams();
  const departmentId = searchParams.get('department_id') || '';
  const labName = searchParams.get('lab_name') || 'Lab Department';
  const cycle = searchParams.get('cycle') === 'even' ? 'even' : 'odd';
  const [entries, setEntries] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const preferences = useMemo(() => getTimetablePreferences(), []);
  const days = preferences.workingDays;
  const periods = Array.from({ length: preferences.periodsPerDay }, (_, index) => index + 1);

  useEffect(() => {
    if (!departmentId) { setLoading(false); return; }
    Promise.all([api.timetable.master(departmentId), api.classes.list({ department_id: departmentId })])
      .then(([entryData, classData]: any[]) => {
        const classList = Array.isArray(classData) ? classData : [];
        const allowedClassIds = new Set(classList
          .filter(item => cycle === 'odd' ? item.semester % 2 === 1 : item.semester % 2 === 0)
          .map(item => item.id));
        setClasses(classList);
        setEntries((Array.isArray(entryData) ? entryData : []).filter(entry =>
          entry.subject_type === 'lab' && allowedClassIds.has(entry.class_id)
        ));
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [departmentId, cycle]);

  const semesterByClass = new Map(classes.map(item => [item.id, item.semester]));
  const exportPdf = () => {
    try {
      exportTimetablePdf({
        title: `${labName} Lab Timetable`,
        subtitle: `${cycle === 'odd' ? 'Odd' : 'Even'} Semester · ${entries.length} lab periods`,
        entries,
        periods: periods.map(number => ({ number, label: `P${number}` })),
      });
    } catch (error: any) {
      toast.error(error.message || 'Could not export the lab timetable');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1500, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <p style={{ color: '#7c3aed', fontSize: 13, fontWeight: 800, marginBottom: 5 }}>LAB DEPARTMENT TIMETABLE</p>
          <h1 style={{ fontSize: 30, color: '#0f172a' }}>{labName} · {cycle === 'odd' ? 'Odd' : 'Even'} Semester</h1>
          <p style={{ color: '#64748b', marginTop: 7 }}>Only laboratory periods are shown. Different classes may run labs in the same period and are listed together.</p>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          {!!entries.length && <button type="button" className="btn btn-primary" onClick={exportPdf}><Download size={16} /> Export timetable PDF</button>}
          <Link href="/timetable/generate" className="btn btn-secondary">Back to generation</Link>
        </div>
      </header>

      {loading ? <div className="card">Loading lab timetable...</div> : !departmentId ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>Choose a lab department from the generation page.</div>
      ) : !entries.length ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}><h2>No lab periods generated</h2><p style={{ color: '#64748b', marginTop: 8 }}>Generate the selected semester stages after assigning lab subjects and faculty.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc' }}><th style={{ padding: 14, border: '1px solid #e2e8f0', textAlign: 'left' }}>Period</th>{days.map(day => <th key={day} style={{ padding: 14, border: '1px solid #e2e8f0' }}>{DAY_NAMES[day] || `Day ${day}`}</th>)}</tr></thead>
            <tbody>{periods.map(period => <tr key={period}>
              <th style={{ padding: 14, border: '1px solid #e2e8f0', color: '#475569', verticalAlign: 'top' }}>P{period}</th>
              {days.map(day => {
                const slotEntries = entries.filter(entry => entry.day + 1 === day && entry.period === period);
                return <td key={day} style={{ padding: 8, border: '1px solid #e2e8f0', minWidth: 190, verticalAlign: 'top', background: slotEntries.length ? '#faf5ff' : '#fff' }}>
                  {slotEntries.length === 0 ? <span style={{ minHeight: 64, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 11, fontWeight: 650 }}>Free</span> : <div style={{ display: 'grid', gap: 7 }}>
                    {slotEntries.map(entry => <article key={entry.id} style={{ padding: 9, borderRadius: 8, border: '1px solid #ddd6fe', background: '#fff' }}>
                      <strong style={{ display: 'block', color: '#6d28d9', fontSize: 12 }}>{entry.subject_code} · Semester {semesterByClass.get(entry.class_id) || '-'}</strong>
                      <span style={{ display: 'block', color: '#0f172a', fontSize: 13, fontWeight: 700, marginTop: 3 }}>{entry.subject_name}</span>
                      <small style={{ display: 'block', color: '#64748b', marginTop: 3 }}>{entry.class_label} · {entry.faculty_name || 'Faculty not assigned'}</small>
                    </article>)}
                  </div>}
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
