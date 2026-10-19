'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Activity, BookOpen, CalendarDays, Camera, Clock, Download, ImageOff, Layers, Plus, Search, Trash2, UserRound, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import TimetableGrid from '@/components/timetable/TimetableGrid';
import { exportTimetablePdf } from '@/lib/timetable-pdf';
import { getDefaultSemesterCycle } from '@/lib/preferences';

const periods = [1, 2, 3, 4, 5, 6, 7].map(number => ({ number, label: `P${number}`, start_time: '', end_time: '' }));

export default function FacultyPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'super_admin' || user?.role === 'hod';
  const [faculty, setFaculty] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [directoryDepartmentId, setDirectoryDepartmentId] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [semesterCycle, setSemesterCycle] = useState<'odd' | 'even'>(getDefaultSemesterCycle);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [people, departmentList, subjectList] = await Promise.all([
        api.faculty.list() as Promise<any[]>, api.departments.list() as Promise<any[]>, api.subjects.list() as Promise<any[]>,
      ]);
      setFaculty(people || []);
      setDepartments(departmentList || []);
      setSubjects(subjectList || []);
      setSelected(current => people.some(item => item.id === current) ? current : '');
    } catch (error: any) {
      toast.error(error.message || 'Could not load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selected) { setEntries([]); return; }
    setScheduleLoading(true);
    api.timetable.facultyTimetable(selected, semesterCycle)
      .then((data: any) => setEntries(Array.isArray(data) ? data : []))
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setScheduleLoading(false));
  }, [selected, semesterCycle]);

  const normalizedQuery = nameQuery.trim().toLowerCase();
  const hasCompleteDepartmentFilter = Boolean(directoryDepartmentId && directoryDepartmentId !== 'all');
  const visibleFaculty = faculty.filter(item => {
    const matchesDepartment = !hasCompleteDepartmentFilter || item.department_id === directoryDepartmentId;
    return (
      matchesDepartment &&
      (!normalizedQuery || item.name.toLowerCase().includes(normalizedQuery))
    );
  });
  const selectedFaculty = faculty.find(item => item.id === selected);
  const cycleSubjects = (selectedFaculty?.subjects || []).filter((subject: any) =>
    typeof subject.semester !== 'number' || subject.semester % 2 === (semesterCycle === 'odd' ? 1 : 0)
  );
  const selectedDepartment = departments.find(item => item.id === selectedFaculty?.department_id);
  const addFormDepartments = departments;
  const directoryDepartments = departments.filter(item => (item.department_type || 'department') !== 'lab');
  const gridEntries = entries.map(entry => ({ ...entry, day_of_week: entry.day + 1, period_number: entry.period, teacher_name: entry.faculty_name, room_name: entry.class_label }));
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dayCounts = [0, 1, 2, 3, 4].map(d => ({
    day: DAYS[d],
    count: entries.filter((e: any) => e.day === d).length,
  }));
  const uniqueClasses = Array.from(new Set(entries.map((e: any) => e.class_label).filter(Boolean)));
  const maxDayLoad = Math.max(0, ...dayCounts.map(d => d.count));
  const workloadLevel = entries.length === 0 ? 'unassigned' : entries.length > 18 ? 'heavy' : entries.length >= 10 ? 'balanced' : 'light';

  const createFaculty = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created: any = await api.faculty.create({ name: name.trim(), department_id: departmentId, can_teach_all_classes: false });
      setName(''); setDepartmentId(''); setShowAdd(false);
      toast.success('Faculty member added');
      await load();
      if (created?.id) setSelected(created.id);
    } catch (error: any) {
      toast.error(error.message || 'Could not add faculty');
    } finally { setSaving(false); }
  };

  const removeFaculty = async (item: any) => {
    if (!confirm(`Remove ${item.name}? This cannot be undone.`)) return;
    try {
      await api.faculty.delete(item.id);
      if (selected === item.id) setSelected('');
      toast.success('Faculty member removed');
      await load();
    } catch (error: any) { toast.error(error.message || 'Could not remove faculty'); }
  };

  const updateFacultyPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedFaculty) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose a valid image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Faculty photo must be smaller than 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const photoUrl = String(reader.result || '');
      try {
        await api.faculty.update(selectedFaculty.id, { photo_url: photoUrl });
        setFaculty(current => current.map(item => item.id === selectedFaculty.id ? { ...item, photo_url: photoUrl } : item));
        toast.success('Faculty profile photo updated');
      } catch (error: any) {
        toast.error(error.message || 'Could not update profile photo');
      }
    };
    reader.onerror = () => toast.error('Could not read the selected image');
    reader.readAsDataURL(file);
  };

  const removeFacultyPhoto = async () => {
    if (!selectedFaculty?.photo_url || !confirm(`Remove ${selectedFaculty.name}'s profile photo?`)) return;
    try {
      await api.faculty.update(selectedFaculty.id, { photo_url: null });
      setFaculty(current => current.map(item => item.id === selectedFaculty.id ? { ...item, photo_url: null } : item));
      toast.success('Faculty profile photo removed');
    } catch (error: any) {
      toast.error(error.message || 'Could not remove profile photo');
    }
  };

  const exportPdf = () => {
    if (!selectedFaculty) return;
    try {
      exportTimetablePdf({ title: `${semesterCycle === 'odd' ? 'Odd' : 'Even'} Faculty Timetable`, subtitle: `${selectedFaculty.name} - ${selectedDepartment?.name || 'Department'}`, entries: gridEntries, periods, facultyDetails: { name: selectedFaculty.name, departmentName: selectedDepartment?.name || selectedFaculty.department?.name || 'Department not assigned', semesterCycle: `${semesterCycle === 'odd' ? 'Odd' : 'Even'} semester`, subjects: cycleSubjects } });
    } catch (error: any) { toast.error(error.message); }
  };

  return (
    <div className="faculty-page">
      <header className="faculty-page-header">
        <div><span className="page-eyebrow">People & workload</span><h1>Faculty directory</h1><p>Choose a department type and department to view all assigned faculty and their weekly schedules.</p></div>
        {canManage && <button className="btn btn-primary btn-lg" onClick={() => setShowAdd(value => !value)} aria-expanded={showAdd}><Plus size={18} /> Add faculty</button>}
      </header>

      {showAdd && canManage && (
        <form className="faculty-add-panel" onSubmit={createFaculty} aria-label="Add faculty member">
          <div className="add-panel-heading"><div><strong>New faculty member</strong><span>Add basic details now; subjects can be assigned afterward.</span></div><button type="button" className="icon-button" onClick={() => setShowAdd(false)} aria-label="Close add faculty form"><X size={18} /></button></div>
          <div className="add-panel-fields">
            <div><label htmlFor="faculty-name">Full name</label><input id="faculty-name" className="form-input" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Dr. Priya Raman" autoFocus required /></div>
            <div><label htmlFor="faculty-department">Department</label><select id="faculty-department" className="form-input" value={departmentId} onChange={event => setDepartmentId(event.target.value)} style={{ color: departmentId ? '#334155' : '#94a3b8' }} required><option value="" disabled hidden>Choose department</option>{addFormDepartments.filter(item => (item.department_type || 'department') !== 'lab').map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add member'}</button>
          </div>
        </form>
      )}

      <div className="faculty-toolbar">
        <label className="faculty-directory-filter"><span>Department</span><select value={directoryDepartmentId || 'all'} onChange={event => { setDirectoryDepartmentId(event.target.value === 'all' ? '' : event.target.value); setNameQuery(''); setSelected(''); }} style={{ color: '#334155' }}><option value="all">All Departments</option>{directoryDepartments.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
        <label className="faculty-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search faculty by name</span><input value={nameQuery} onChange={event => { setNameQuery(event.target.value); setSelected(''); }} placeholder="Search all faculty by name…" /></label>
        <div className="faculty-total"><Users size={17} /><strong>{visibleFaculty.length}</strong><span>members</span></div>
      </div>

      <div className="faculty-layout">
        <aside className="faculty-list" aria-label="Faculty members">
          {loading ? Array.from({ length: 5 }).map((_, index) => <div className="faculty-list-skeleton skeleton" key={index} />) : visibleFaculty.map(item => {
            const active = selected === item.id;
            return (
              <button className={`faculty-list-item ${active ? 'active' : ''}`} key={item.id} onClick={() => setSelected(item.id)} aria-pressed={active}>
                <span className="faculty-avatar">{item.photo_url ? <img src={item.photo_url} alt="" /> : item.name.slice(0, 1).toUpperCase()}</span>
                <span className="faculty-list-copy"><strong>{item.name}</strong><small>{item.department?.code || departments.find(dept => dept.id === item.department_id)?.code || 'No department'} · {item.subjects?.length || 0} subjects</small></span>
                <span className="faculty-chevron" aria-hidden="true">›</span>
              </button>
            );
          })}
          {!loading && !visibleFaculty.length && <div className="faculty-list-empty"><UserRound size={28} /><strong>{nameQuery ? 'No matching faculty' : directoryDepartmentId ? 'No faculty found' : 'No faculty found'}</strong><span>{nameQuery ? 'Try a different faculty name.' : directoryDepartmentId ? 'No faculty members are assigned to this department.' : 'No faculty members have been added yet.'}</span></div>}
        </aside>

        <section className="faculty-detail" aria-live="polite">
          {!selectedFaculty ? (
            <div className="faculty-detail-empty"><div><UserRound size={34} /></div><h2>Select a faculty member</h2><p>Choose someone from the directory to see their subjects and weekly timetable.</p></div>
          ) : (
            <>
              <div className="faculty-profile">
                <button type="button" className={`profile-avatar ${canManage ? 'is-editable' : ''}`} onClick={() => canManage && photoInputRef.current?.click()} disabled={!canManage} aria-label={canManage ? `Add or change ${selectedFaculty.name}'s profile photo` : `${selectedFaculty.name}'s profile photo`} title={canManage ? 'Add or change profile photo' : undefined}>
                  {selectedFaculty.photo_url ? <img src={selectedFaculty.photo_url} alt={`${selectedFaculty.name} profile`} /> : selectedFaculty.name.slice(0, 1).toUpperCase()}
                  {canManage && <span className="profile-photo-icon"><Camera size={14} /></span>}
                </button>
                <input ref={photoInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={updateFacultyPhoto} tabIndex={-1} />
                <div className="profile-copy"><span>Faculty profile</span><h2>{selectedFaculty.name}</h2><p>{selectedDepartment?.name || selectedFaculty.department?.name || 'Department not assigned'}</p></div>
                <div className="profile-actions">
                  <div className="cycle-switch" aria-label="Semester cycle"><button className={semesterCycle === 'odd' ? 'active' : ''} onClick={() => setSemesterCycle('odd')} aria-pressed={semesterCycle === 'odd'}>Odd</button><button className={semesterCycle === 'even' ? 'active' : ''} onClick={() => setSemesterCycle('even')} aria-pressed={semesterCycle === 'even'}>Even</button></div>
                  {canManage && selectedFaculty.photo_url && <button className="btn btn-secondary" onClick={removeFacultyPhoto}><ImageOff size={16} /> Remove photo</button>}
                  {!!entries.length && <button className="btn btn-secondary" onClick={exportPdf}><Download size={16} /> Export timetable PDF</button>}
                  {canManage && <button className="icon-button danger" onClick={() => removeFaculty(selectedFaculty)} aria-label={`Remove ${selectedFaculty.name}`} title="Remove faculty"><Trash2 size={17} /></button>}
                </div>
              </div>

              <div className="faculty-metrics">
                <div><CalendarDays size={18} /><span>Weekly periods</span><strong>{entries.length}</strong></div>
                <div><BookOpen size={18} /><span>Assigned subjects</span><strong>{cycleSubjects.length}</strong></div>
                <div><Layers size={18} /><span>Classes assigned</span><strong>{uniqueClasses.length}</strong></div>
                <div><Clock size={18} /><span>Peak daily load</span><strong>{maxDayLoad} hrs</strong></div>
              </div>

              {entries.length > 0 && (
                <div className="faculty-workload-breakdown">
                  <div className="workload-summary-title">
                    <Activity size={14} />
                    <span>Daily distribution ({semesterCycle} cycle)</span>
                    <span className={`workload-tag ${workloadLevel}`}>
                      {workloadLevel === 'unassigned' ? 'Unassigned' : workloadLevel === 'heavy' ? 'Intensive Load' : workloadLevel === 'balanced' ? 'Balanced Load' : 'Light Load'}
                    </span>
                  </div>
                  <div className="workload-day-bars">
                    {dayCounts.map(d => (
                      <div key={d.day} className="workload-day-col">
                        <div className="workload-bar-wrap">
                          <div
                            className="workload-bar-fill"
                            style={{ height: `${Math.max(8, Math.min(100, (d.count / 7) * 100))}%` }}
                          />
                        </div>
                        <span className="workload-day-label">{d.day}</span>
                        <span className="workload-day-val">{d.count}p</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!cycleSubjects.length && <div className="subject-strip" aria-label={`${semesterCycle} semester assigned subjects`}>{cycleSubjects.map((subject: any) => <span key={subject.id}>{subject.code}<small>{subject.name}</small></span>)}</div>}

              <div className="faculty-schedule-heading"><div><h3>{semesterCycle === 'odd' ? 'Odd' : 'Even'} semester timetable</h3><p>{entries.length} scheduled periods across the week</p></div></div>
              {scheduleLoading ? <div className="schedule-skeleton skeleton" /> : !entries.length ? <div className="schedule-empty"><CalendarDays size={28} /><strong>No scheduled periods</strong><span>This faculty member has no classes in the selected semester cycle.</span></div> : <div className="faculty-grid-scroll"><TimetableGrid entries={gridEntries} periods={periods} workingDays={[1, 2, 3, 4, 5]} isEditable={false} compact /></div>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
