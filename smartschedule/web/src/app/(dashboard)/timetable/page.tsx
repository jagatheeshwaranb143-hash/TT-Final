'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import TimetableGrid from '@/components/timetable/TimetableGrid';
import { exportTimetablePdf } from '@/lib/timetable-pdf';

const periods = [
  { number: 1, label: 'P1', start_time: '09:00', end_time: '09:50' },
  { number: 2, label: 'P2', start_time: '09:50', end_time: '10:40' },
  { number: 3, label: 'P3', start_time: '10:55', end_time: '11:45' },
  { number: 4, label: 'P4', start_time: '11:45', end_time: '12:35' },
  { number: 5, label: 'P5', start_time: '13:20', end_time: '14:10' },
  { number: 6, label: 'P6', start_time: '14:10', end_time: '15:00' },
  { number: 7, label: 'P7', start_time: '15:00', end_time: '15:50' },
];

export default function TimetablePage() {
  const searchParams = useSearchParams();
  const [classes, setClasses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [semesterGroup, setSemesterGroup] = useState('');
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [limitWarning, setLimitWarning] = useState('');

  useEffect(() => {
    api.periods.workingDays()
      .then((data: any) => setWorkingDays(Array.isArray(data?.working_days) && data.working_days.length ? data.working_days : [1, 2, 3, 4, 5]))
      .catch(() => setWorkingDays([1, 2, 3, 4, 5]));
  }, []);

  useEffect(() => {
    Promise.all([api.classes.list(), api.departments.list()])
      .then(([classData, departmentData]: any[]) => {
        const list = Array.isArray(classData) ? classData : [];
        setClasses(list);
        setDepartments(Array.isArray(departmentData) ? departmentData : []);
        const requested = searchParams.get('class_id');
        const requestedClass = list.find(item => item.id === requested);
        if (requestedClass) {
          setDepartmentFilter(requestedClass.department_id);
          setSemesterGroup(requestedClass.semester % 2 === 0 ? 'even' : 'odd');
          setSelectedClassId(requestedClass.id);
        } else {
          setSelectedClassId('');
        }
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedClassId) { setEntries([]); return; }
    setLoading(true);
    api.timetable.classTimetable(selectedClassId)
      .then((data: any) => setEntries((Array.isArray(data) ? data : []).map(entry => ({
        ...entry,
        day_of_week: entry.day + 1,
        period_number: entry.period,
        teacher_name: entry.faculty_name,
        room_name: 'Room to be assigned',
      }))))
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [selectedClassId]);

  const selectedClass = useMemo(() => classes.find(item => item.id === selectedClassId), [classes, selectedClassId]);
  const filteredClasses = useMemo(() => classes.filter(item =>
    item.department_id === departmentFilter &&
    (semesterGroup === 'odd' ? item.semester % 2 === 1 : semesterGroup === 'even' ? item.semester % 2 === 0 : false)
  ), [classes, departmentFilter, semesterGroup]);
  const label = (item: any) => `${item.department_name || 'Department'} - Year ${item.year}, Semester ${item.semester}`;

  const moveEntry = async (entryId: string, displayDay: number, period: number) => {
    if (moving) return false;
    const current = entries.find(item => item.id === entryId);
    if (!current || (current.day_of_week === displayDay && current.period_number === period)) return true;
    try {
      setMoving(true);
      const updated: any = await api.timetable.editEntry(entryId, { day: displayDay - 1, period });
      setEntries(items => items.map(item => item.id === entryId ? {
        ...item, ...updated, day_of_week: updated.day + 1, period_number: updated.period,
        teacher_name: updated.faculty_name, room_name: 'Room to be assigned',
      } : item));
      toast.success('Period moved successfully');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'That slot is not available');
      return false;
    } finally {
      setMoving(false);
    }
  };

  useEffect(() => {
    const available = selectedClass?.subjects || [];
    setSelectedSubjectId(value => available.some((item: any) => item.subject_id === value) ? value : '');
  }, [selectedClass]);

  const assignSelectedSubject = async (displayDay: number, period: number, existing?: any) => {
    if (!selectedSubjectId || moving || !selectedClassId) return;
    if (selectedSubjectId === '__clear__') {
      if (!existing) { toast('This period is already empty'); return; }
      try { setMoving(true); await api.timetable.deleteEntry(existing.id); setEntries(items => items.filter(item => item.id !== existing.id)); toast.success('Period cleared'); }
      catch (error: any) { toast.error(error.message || 'Could not clear this period'); }
      finally { setMoving(false); }
      return;
    }
    if (existing?.subject_id === selectedSubjectId) {
      toast('That subject is already in this period');
      return;
    }
    const selectedSubject = (selectedClass?.subjects || []).find((item: any) => item.subject_id === selectedSubjectId);
    const scheduledCount = entries.filter(item => item.subject_id === selectedSubjectId && item.id !== existing?.id).length;
    const weeklyLimit = selectedSubject?.periods_per_week || 0;
    if (weeklyLimit > 0 && scheduledCount >= weeklyLimit) {
      const message = `${selectedSubject.subject_name} is fixed at ${weeklyLimit} periods per week. Remove an existing period before adding another.`;
      setLimitWarning(message);
      toast.error(message, { duration: 6000 });
      return;
    }
    try {
      setLimitWarning('');
      setMoving(true);
      const updated: any = existing
        ? await api.timetable.editEntry(existing.id, { subject_id: selectedSubjectId })
        : await api.timetable.createEntry({ class_id: selectedClassId, subject_id: selectedSubjectId, day: displayDay - 1, period });
      const mapped = { ...updated, day_of_week: updated.day + 1, period_number: updated.period, teacher_name: updated.faculty_name, room_name: 'Room to be assigned' };
      setEntries(items => existing ? items.map(item => item.id === existing.id ? mapped : item) : [...items, mapped]);
      toast.success(existing ? 'Subject changed successfully' : 'Subject added to the timetable');
    } catch (error: any) {
      toast.error(error.message || 'Could not assign the subject to this period');
    } finally {
      setMoving(false);
    }
  };

  const deleteEntry = async (entry: any) => {
    if (moving || !window.confirm(`Remove ${entry.subject_name || 'this subject'} from this period?`)) return;
    try {
      setMoving(true);
      await api.timetable.deleteEntry(entry.id);
      setEntries(items => items.filter(item => item.id !== entry.id));
      toast.success('Subject removed from the period');
    } catch (error: any) {
      toast.error(error.message || 'Could not remove this subject');
    } finally {
      setMoving(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 30, letterSpacing: '-.03em' }}>Class timetable</h1><p style={{ color: '#64748b', marginTop: 6 }}>Select a class to view its weekly schedule.</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selectedClass && entries.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => { try { exportTimetablePdf({ title: 'Class Timetable', subtitle: label(selectedClass), entries, periods }); } catch (error: any) { toast.error(error.message); } }}>Export PDF</button>}
          {entries.length > 0 && <button type="button" className={editing ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setEditing(value => !value)}>{editing ? 'Finish editing' : 'Manual edit'}</button>}
          <a href="/timetable/generate" className="btn btn-primary">Generate or regenerate</a>
        </div>
      </div>

      {!classes.length && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><h2>No classes available</h2><p style={{ color: '#64748b', margin: '8px 0 18px' }}>Create a class before viewing a timetable.</p><a href="/classes" className="btn btn-primary">Go to Classes</a></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(190px, .7fr) minmax(300px, 1.5fr)', gap: 14 }}>
              <div><label className="form-label" htmlFor="view-department">Department</label><select id="view-department" className="form-input" value={departmentFilter} onChange={event => { setDepartmentFilter(event.target.value); setSemesterGroup(''); setSelectedClassId(''); }} style={{ marginTop: 7, padding: 11 }}><option value="">Choose a department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></div>
              <div><label className="form-label" htmlFor="view-semester-group">Semester type</label><select id="view-semester-group" className="form-input" value={semesterGroup} onChange={event => { setSemesterGroup(event.target.value); setSelectedClassId(''); }} disabled={!departmentFilter} style={{ marginTop: 7, padding: 11 }}><option value="">Choose semester type</option><option value="odd">Odd Semester</option><option value="even">Even Semester</option></select></div>
              <div><label className="form-label" htmlFor="view-class">Class</label><select id="view-class" className="form-input" value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} disabled={!departmentFilter || !semesterGroup} style={{ marginTop: 7, padding: 11 }}><option value="">Choose a class</option>{filteredClasses.map(item => <option key={item.id} value={item.id}>Year {item.year} — Semester {item.semester}</option>)}</select></div>
            </div>
            {selectedClass && <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>{selectedClass.subjects?.length || 0} subjects configured for this class.</p>}
          </div>

          {loading ? <div className="card">Loading timetable...</div> : !selectedClassId ? (
            <div className="card" style={{ textAlign: 'center', padding: 42 }}><h2>Choose a class</h2><p style={{ color: '#64748b', marginTop: 8 }}>Select a department, odd/even semester group, and class to view its timetable.</p></div>
          ) : !entries.length ? (
            <div className="card" style={{ textAlign: 'center', padding: 42 }}><h2>No timetable generated</h2><p style={{ color: '#64748b', margin: '8px 0 18px' }}>Generate this class timetable after adding its subjects and faculty.</p><a href="/timetable/generate" className="btn btn-primary">Generate timetable</a></div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              {editing && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: 14, padding: 16, border: '1px solid #99f6e4', background: '#f0fdfa', borderRadius: 10, marginBottom: 18 }}>
                <div><label className="form-label" htmlFor="manual-subject">Subject to place</label><select id="manual-subject" className="form-input" value={selectedSubjectId} onChange={event => setSelectedSubjectId(event.target.value)} style={{ marginTop: 6 }}>
                  <option value="">Choose a subject</option>
                  {(selectedClass?.subjects || []).map((subject: any) => {
                    const count = entries.filter(entry => entry.subject_id === subject.subject_id).length;
                    return <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_code} — {subject.subject_name} — {count}/{subject.periods_per_week} periods{count >= subject.periods_per_week ? ' (limit reached)' : ''}</option>;
                  })}
                  <option value="__clear__">Clear selected period</option>
                </select></div>
                <div style={{ color: '#115e59', fontSize: 13, alignSelf: 'end', paddingBottom: 10 }}><strong>Click method:</strong> choose a subject, then click an empty cell to add it or an occupied card to replace its subject. You can also drag cards to move them.</div>
              </div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}><div><strong>{selectedClass ? label(selectedClass) : 'Schedule'}</strong>{editing && <div style={{ color: '#0f766e', fontSize: 13, marginTop: 5, fontWeight: 600 }}>Drag a subject card to an empty period. Conflicts are checked before saving.</div>}</div><span className="badge badge-success">{moving ? 'Saving change…' : `${entries.length} scheduled periods`}</span></div>
              {editing && limitWarning && <div role="alert" style={{ padding: '12px 14px', marginBottom: 16, borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', fontWeight: 600 }}>{limitWarning}</div>}
              <div style={{ minWidth: 980 }}><TimetableGrid entries={entries} periods={periods} workingDays={workingDays} isEditable={editing && !moving} onEntryMove={moveEntry} onEntryDelete={deleteEntry} onCellSelect={assignSelectedSubject} /></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
