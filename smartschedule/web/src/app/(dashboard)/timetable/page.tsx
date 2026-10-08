'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import TimetableGrid from '@/components/timetable/TimetableGrid';
import { exportTimetablePdf } from '@/lib/timetable-pdf';
import { getBasicPreferences, getDefaultSemesterCycle, getTimetablePreferences, setTimetablePreferences } from '@/lib/preferences';

const defaultPeriods = [
  { number: 1, label: 'P1', start_time: '09:00', end_time: '09:50' },
  { number: 2, label: 'P2', start_time: '09:50', end_time: '10:40' },
  { number: 3, label: 'P3', start_time: '10:55', end_time: '11:45' },
  { number: 4, label: 'P4', start_time: '11:45', end_time: '12:35' },
  { number: 5, label: 'P5', start_time: '13:20', end_time: '14:10' },
  { number: 6, label: 'P6', start_time: '14:10', end_time: '15:00' },
  { number: 7, label: 'P7', start_time: '15:00', end_time: '15:50' },
];

function preferredPeriods() {
  const preferences = getTimetablePreferences();
  const [hour, minute] = preferences.dayStart.split(':').map(Number);
  const start = hour * 60 + minute;
  return Array.from({ length: preferences.periodsPerDay }, (_, index) => {
    const from = start + index * preferences.periodMinutes;
    const to = from + preferences.periodMinutes;
    const format = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    return { number: index + 1, label: `P${index + 1}`, start_time: format(from), end_time: format(to) };
  });
}

function initialTemplateSignatories() {
  const saved = getTimetablePreferences().pdfStructure?.signatories;
  return {
    classCoordinator: saved?.classCoordinator || '',
    facultyAdvisor: saved?.facultyAdvisor || '',
    timetableIncharge: saved?.timetableIncharge || '',
    overallTtCoordinator: saved?.overallTtCoordinator || '',
    hod: saved?.hod || '',
    vicePrincipal: saved?.vicePrincipal || 'Dr.P.SUJATHA',
    principal: saved?.principal || 'Dr.M.ARULKUMARAN',
  };
}

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
  const [departmentTypeFilter, setDepartmentTypeFilter] = useState<'department' | 'lab' | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [semesterGroup, setSemesterGroup] = useState<'odd' | 'even'>(getDefaultSemesterCycle);
  const [workingDays, setWorkingDays] = useState(() => getTimetablePreferences().workingDays);
  const [limitWarning, setLimitWarning] = useState('');
  const [periods] = useState(() => typeof window === 'undefined' ? defaultPeriods : preferredPeriods());
  const [showTemplateView, setShowTemplateView] = useState(false);
  const [includeBreaksInPdf, setIncludeBreaksInPdf] = useState(false);
  const [editSignatories, setEditSignatories] = useState(false);
  const [facultyNames, setFacultyNames] = useState<string[]>([]);
  const [facultyDetails, setFacultyDetails] = useState<any[]>([]);
  const [signatories, setSignatories] = useState(initialTemplateSignatories);
  const templatePreferences = getTimetablePreferences();
  const configuredTemplateColumns = templatePreferences.pdfStructure?.columns?.length ? templatePreferences.pdfStructure.columns : periods.flatMap(period => [
    { kind: 'period' as const, label: period.label },
    ...(period.number === templatePreferences.intervalAfterPeriod && templatePreferences.intervalMinutes > 0 ? [{ kind: 'break' as const, label: 'BREAK' }] : []),
    ...(period.number === templatePreferences.lunchAfterPeriod && templatePreferences.lunchMinutes > 0 ? [{ kind: 'lunch' as const, label: 'LUNCH' }] : []),
  ]);
  const templateColumns = configuredTemplateColumns.flatMap((column, index) => {
    const periodNumber = Number(column.label.match(/\d+/)?.[0]);
    if (column.kind !== 'period' || periodNumber !== 6) return [column];
    const next = configuredTemplateColumns[index + 1];
    const hasBreakAfterSix = next?.kind === 'break' && Number(next.label.match(/\d+/)?.[0] || periodNumber) === periodNumber;
    return hasBreakAfterSix ? [column] : [column, { kind: 'break' as const, label: 'BREAK' }];
  });
  const periodTimes = useMemo(() => {
    const [startHour, startMinute] = templatePreferences.dayStart.split(':').map(Number);
    let cursor = startHour * 60 + startMinute;
    const formatTime = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return new Map(periods.map(period => {
      const start = cursor;
      const end = start + templatePreferences.periodMinutes;
      cursor = end;
      if (period.number === templatePreferences.intervalAfterPeriod) cursor += templatePreferences.intervalMinutes;
      if (period.number === templatePreferences.lunchAfterPeriod) cursor += templatePreferences.lunchMinutes;
      return [period.number, `${formatTime(start)}-${formatTime(end)}`] as const;
    }));
  }, [periods, templatePreferences.dayStart, templatePreferences.periodMinutes, templatePreferences.intervalAfterPeriod, templatePreferences.intervalMinutes, templatePreferences.lunchAfterPeriod, templatePreferences.lunchMinutes]);

  useEffect(() => { api.faculty.list().then((data: any) => { const faculty = Array.isArray(data) ? data : []; setFacultyDetails(faculty); setFacultyNames([...new Set(faculty.map((item: any) => String(item.name || '').trim()).filter(Boolean))] as string[]); }); }, []);

  const saveSignatories = async () => {
    try {
      const saved: any = await api.settings.get();
      const timetable = getTimetablePreferences();
      const pdfStructure = timetable.pdfStructure || { columns: templateColumns, workingDays: [], sourceName: 'Custom timetable template' };
      const updatedTimetable = { ...saved.timetable, ...timetable, pdfStructure: { ...pdfStructure, signatories } };
      await api.settings.save({ ...saved, timetable: updatedTimetable });
      setTimetablePreferences({ ...timetable, pdfStructure: { ...pdfStructure, signatories } });
      setEditSignatories(false);
      toast.success('Template signatories saved');
    } catch (error: any) { toast.error(error.message || 'Could not save template signatories'); }
  };

  useEffect(() => {
    Promise.all([api.classes.list(), api.departments.list()])
      .then(([classData, departmentData]: any[]) => {
        const list = Array.isArray(classData) ? classData : [];
        const departmentList = Array.isArray(departmentData) ? departmentData : [];
        setClasses(list);
        setDepartments(departmentList);
        const requested = searchParams.get('class_id');
        const requestedClass = list.find(item => item.id === requested);
        if (requestedClass) {
          const requestedDepartment = departmentList.find(item => item.id === requestedClass.department_id);
          setDepartmentTypeFilter((requestedDepartment?.department_type || 'department') as 'department' | 'lab');
          setDepartmentFilter(requestedClass.department_id);
          setSemesterGroup(requestedClass.semester % 2 === 0 ? 'even' : 'odd');
          setSelectedClassId(requestedClass.id);
        } else {
          const requestedDepartmentId = searchParams.get('department_id') || '';
          const requestedDepartment = departmentList.find(item => item.id === requestedDepartmentId);
          setDepartmentTypeFilter(requestedDepartment ? ((searchParams.get('department_type') || requestedDepartment.department_type || 'department') as 'department' | 'lab') : '');
          setDepartmentFilter(requestedDepartment?.id || '');
          setSemesterGroup(getDefaultSemesterCycle());
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
        day_of_week: entry.day_of_week ?? entry.day + 1,
        period_number: entry.period_number ?? entry.period,
        teacher_name: entry.faculty_name,
        room_name: 'Room to be assigned',
      }))))
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [selectedClassId]);

  const selectedClass = useMemo(() => classes.find(item => item.id === selectedClassId), [classes, selectedClassId]);
  const departmentFaculty = useMemo(() => facultyDetails.filter(member => member.department_id === selectedClass?.department_id), [facultyDetails, selectedClass?.department_id]);
  const filteredDepartments = useMemo(() => departments.filter(item =>
    (item.department_type || 'department') === departmentTypeFilter
  ), [departments, departmentTypeFilter]);
  const departmentKey = (value: string = '') => value.toLowerCase().replace(/laboratory|lab/g, '').replace(/[^a-z0-9]/g, '');
  const selectedFilterDepartment = departments.find(item => item.id === departmentFilter);
  const linkedLiteratureDepartment = departmentTypeFilter === 'lab' && selectedFilterDepartment
    ? departments.find(item => {
        if ((item.department_type || 'department') !== 'department') return false;
        const keys = new Set([departmentKey(selectedFilterDepartment.code), departmentKey(selectedFilterDepartment.name)].filter(Boolean));
        return keys.has(departmentKey(item.code)) || keys.has(departmentKey(item.name));
      })
    : undefined;
  const classDepartmentId = linkedLiteratureDepartment?.id || departmentFilter;
  const filteredClasses = useMemo(() => classes.filter(item =>
    item.department_id === classDepartmentId &&
    (semesterGroup === 'odd' ? item.semester % 2 === 1 : item.semester % 2 === 0)
  ).sort((a, b) => a.year - b.year || a.semester - b.semester || String(a.section).localeCompare(String(b.section))), [classes, classDepartmentId, semesterGroup]);
  const departmentLabel = (item: any) => departments.find(department => department.id === item.department_id)?.code || item.department_name || 'Department';
  const classOptionLabel = (item: any) => `Year ${item.year} - ${departmentLabel(item)} - Section ${item.section}`;
  const label = (item: any) => `${departmentLabel(item)} - Year ${item.year}, Semester ${item.semester}, Section ${item.section}`;

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

  const clearAllPeriods = async () => {
    if (moving || !selectedClassId || entries.length === 0) return;
    const className = selectedClass ? label(selectedClass) : 'this class';
    const workflow = semesterGroup === 'odd' ? [7, 5, 3, 1] : [8, 6, 4, 2];
    const dependentSemesters = selectedClass ? workflow.slice(workflow.indexOf(selectedClass.semester)) : [];
    const dependentYears = dependentSemesters.map(semester => `Year ${Math.ceil(semester / 2)}`).join(', ');
    const dependencyMessage = dependentSemesters.length > 1
      ? `This also deletes dependent ${semesterGroup} semester timetables for ${dependentYears.slice(dependentYears.indexOf(', ') + 2)} in this department.`
      : `Only the selected ${semesterGroup} semester timetable is deleted.`;
    if (!window.confirm(`Delete scheduled periods for ${className} and dependent years?\n\n${dependencyMessage}\n\nOther departments using the same faculty are unaffected. This cannot be undone.`)) return;
    try {
      setMoving(true);
      const result: any = await api.timetable.clearClass(selectedClassId);
      setEntries([]);
      setEditing(false);
      setSelectedSubjectId('');
      setLimitWarning('');
      toast.success(`${result.entries_deleted || entries.length} periods cleared across ${result.classes_cleared || 1} class timetable${result.classes_cleared === 1 ? '' : 's'}`);
    } catch (error: any) {
      toast.error(error.message || 'Could not clear the timetable');
    } finally {
      setMoving(false);
    }
  };

  const exportSelectedClassPdf = () => {
    if (!selectedClass) return;
    try {
      const preferences = getTimetablePreferences();
      const basic = getBasicPreferences();
      const breakLabels = includeBreaksInPdf
        ? [...new Set(['Break after Period 6', ...(preferences.intervalMinutes > 0 && preferences.intervalAfterPeriod !== 6 ? [`Interval after Period ${preferences.intervalAfterPeriod}`] : []), ...(preferences.lunchMinutes > 0 ? [`Lunch after Period ${preferences.lunchAfterPeriod}`] : [])])]
        : [];
      const subtitle = `${preferences.includeInstitutionName ? `${basic.institutionName} - ` : ''}${label(selectedClass)}${breakLabels.length ? `\nBreaks: ${breakLabels.join('; ')}` : ''}`;
      exportTimetablePdf({
        title: preferences.pdfTitle,
        subtitle,
        entries,
        periods,
        includeBreaks: includeBreaksInPdf,
        templateDetails: {
          subjects: (selectedClass.subjects || []).map((subject: any) => ({ ...subject, faculty_department: facultyDetails.find((member: any) => member.id === subject.faculty_id)?.department?.name })),
          departmentName: selectedClass.department_name || '',
        },
      });
    } catch (error: any) { toast.error(error.message); }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 30, letterSpacing: '-.03em' }}>Class timetable</h1><p style={{ color: '#64748b', marginTop: 6 }}>Select a class to view its weekly schedule.</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selectedClass && entries.length > 0 && <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#475569', fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={includeBreaksInPdf} onChange={event => setIncludeBreaksInPdf(event.target.checked)} /> Breaks in PDF</label>
            <button type="button" className="btn btn-secondary" onClick={exportSelectedClassPdf}>Export timetable PDF</button>
          </>}
          {selectedClass && entries.length > 0 && <button type="button" className="btn btn-secondary" aria-pressed={showTemplateView} onClick={() => setShowTemplateView(value => !value)}>{showTemplateView ? 'Standard timetable view' : 'Show timetable with template'}</button>}
          {showTemplateView && <button type="button" className="btn btn-secondary" onClick={() => setEditSignatories(value => !value)}>{editSignatories ? 'Close signatory editor' : 'Edit template signatories'}</button>}
          {entries.length > 0 && <button type="button" className={editing ? 'btn btn-primary' : 'btn btn-secondary'} aria-expanded={editing} aria-controls="manual-edit-tools" onClick={() => { setEditing(value => !value); setSelectedSubjectId(''); setLimitWarning(''); }}>{editing ? 'Finish editing' : 'Manual edit'}</button>}
          <Link href={selectedClassId ? `/timetable/generate?department_type=${encodeURIComponent(departmentTypeFilter)}&department_id=${encodeURIComponent(departmentFilter)}&cycle=${semesterGroup}&class_id=${encodeURIComponent(selectedClassId)}` : '/timetable/generate'} className="btn btn-primary">Generate or regenerate</Link>
        </div>
      </div>

      {!classes.length && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><h2>No classes available</h2><p style={{ color: '#64748b', margin: '8px 0 18px' }}>Create a class before viewing a timetable.</p><Link href="/classes" className="btn btn-primary">Go to Classes</Link></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, .8fr) minmax(220px, 1fr) minmax(190px, .7fr) minmax(280px, 1.35fr)', gap: 14 }}>
              <div><label className="form-label" htmlFor="view-department-type">Department type</label><select id="view-department-type" className="form-input" value={departmentTypeFilter} onChange={event => { setDepartmentTypeFilter(event.target.value as 'department' | 'lab' | ''); setDepartmentFilter(''); setSelectedClassId(''); }} style={{ marginTop: 7, padding: 11, color: departmentTypeFilter ? '#334155' : '#94a3b8' }}><option value="" disabled hidden>Choose department type</option><option value="department">Literature Department</option><option value="lab">Lab Department</option></select></div>
              <div><label className="form-label" htmlFor="view-department">Department</label><select id="view-department" className="form-input" value={departmentFilter} onChange={event => { setDepartmentFilter(event.target.value); setSemesterGroup(getDefaultSemesterCycle()); setSelectedClassId(''); }} disabled={!departmentTypeFilter} style={{ marginTop: 7, padding: 11, color: departmentFilter ? '#334155' : '#94a3b8' }}><option value="" disabled hidden>{departmentTypeFilter ? 'Choose a department' : 'Choose department type first'}</option>{filteredDepartments.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></div>
              <div><label className="form-label" htmlFor="view-semester-group">Semester type</label><select id="view-semester-group" className="form-input" value={semesterGroup} onChange={event => { setSemesterGroup(event.target.value as 'odd' | 'even'); setSelectedClassId(''); }} disabled={!departmentFilter} style={{ marginTop: 7, padding: 11 }}><option value="odd">Odd Semester</option><option value="even">Even Semester</option></select></div>
              <div><label className="form-label" htmlFor="view-class">Class ({filteredClasses.length} available)</label><select id="view-class" className="form-input" value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} disabled={!departmentFilter || filteredClasses.length === 0} style={{ marginTop: 7, padding: 11, color: selectedClassId ? '#334155' : '#94a3b8' }}><option value="" disabled hidden>{filteredClasses.length ? 'Choose a class' : 'No classes available'}</option>{filteredClasses.map(item => <option key={item.id} value={item.id}>{classOptionLabel(item)}</option>)}</select></div>
            </div>
            {selectedClass && <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>{selectedClass.subjects?.length || 0} subjects configured for this class.</p>}
          </div>

          {loading ? <div className="card">Loading timetable...</div> : !selectedClassId ? (
            <div className="card" style={{ textAlign: 'center', padding: 42 }}><h2>Choose a class</h2><p style={{ color: '#64748b', marginTop: 8 }}>Select a department, semester, and class to view its timetable.</p></div>
          ) : !entries.length ? (
            <div className="card" style={{ textAlign: 'center', padding: 42 }}><h2>No timetable generated</h2><p style={{ color: '#64748b', margin: '8px 0 18px' }}>Generate this class timetable after adding its subjects and faculty.</p><Link href={`/timetable/generate?department_type=${encodeURIComponent(departmentTypeFilter)}&department_id=${encodeURIComponent(departmentFilter)}&cycle=${semesterGroup}&class_id=${encodeURIComponent(selectedClassId)}`} className="btn btn-primary">Generate timetable</Link></div>
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              {editing && <section id="manual-edit-tools" className="manual-subject-picker compact" aria-labelledby="compact-manual-heading">
                <div className="manual-subject-header">
                  <div>
                    <h3 id="compact-manual-heading">Manual edit</h3>
                    <p>Choose a subject or laboratory, then click a timetable period.</p>
                  </div>
                  <div className="manual-clear-actions">
                    <button type="button" className={`manual-clear-option${selectedSubjectId === '__clear__' ? ' active' : ''}`} aria-pressed={selectedSubjectId === '__clear__'} onClick={() => setSelectedSubjectId(selectedSubjectId === '__clear__' ? '' : '__clear__')}>
                      <span aria-hidden="true">x</span> Remove a period
                    </button>
                    <button type="button" className="manual-clear-all" disabled={moving || entries.length === 0} onClick={clearAllPeriods}>
                      Clear all periods
                    </button>
                  </div>
                </div>
                <div className="manual-subject-groups" aria-label="Subject to place">
                  {[
                    { label: 'Subjects', type: 'theory', items: (selectedClass?.subjects || []).filter((subject: any) => subject.subject_type !== 'lab') },
                    { label: 'Laboratories', type: 'lab', items: (selectedClass?.subjects || []).filter((subject: any) => subject.subject_type === 'lab') },
                  ].map(group => group.items.length > 0 && <div className="manual-subject-group" key={group.label}>
                    <div className={`manual-subject-group-label ${group.type}`}>
                      {group.label}<span>{group.items.length}</span>
                    </div>
                    <div className="manual-subject-options">
                      {group.items.map((subject: any) => {
                        const count = entries.filter(entry => entry.subject_id === subject.subject_id).length;
                        const limitReached = count >= subject.periods_per_week;
                        const selected = selectedSubjectId === subject.subject_id;
                        return <button
                          type="button"
                          key={subject.subject_id}
                          className={`manual-subject-option ${group.type}${selected ? ' active' : ''}`}
                          aria-pressed={selected}
                          disabled={limitReached && !selected}
                          title={limitReached ? 'All configured weekly periods have been placed' : `Place ${subject.subject_name}`}
                          onClick={() => setSelectedSubjectId(selected ? '' : subject.subject_id)}
                        >
                          <span className="manual-subject-code">{subject.subject_code}</span>
                          <span className="manual-subject-name">{subject.subject_name}</span>
                          <span className={`manual-subject-count${limitReached ? ' full' : ''}`}>{limitReached ? 'Full' : `${count}/${subject.periods_per_week}`}</span>
                        </button>;
                      })}
                    </div>
                  </div>)}
                </div>
                <p className="manual-subject-help"><strong>{selectedSubjectId ? 'Ready:' : 'Tip:'}</strong> {selectedSubjectId === '__clear__' ? 'click an occupied period to remove it.' : selectedSubjectId ? 'click an empty period to add it, or an occupied period to replace it.' : 'choose an item above, or drag an existing card to another period.'}</p>
              </section>}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}><div><strong>{selectedClass ? label(selectedClass) : 'Schedule'}</strong>{editing && <div style={{ color: '#0f766e', fontSize: 13, marginTop: 5, fontWeight: 600 }}>Drag a subject card to an empty period. Conflicts are checked before saving.</div>}</div><span className="badge badge-success">{moving ? 'Saving change...' : `${entries.length} scheduled periods`}</span></div>
              {editing && limitWarning && <div role="alert" style={{ padding: '12px 14px', marginBottom: 16, borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', fontWeight: 600 }}>{limitWarning}</div>}
              {showTemplateView ? <section className="class-template-view" aria-label="Timetable in uploaded template structure">
                <div className="class-template-heading"><strong>{getBasicPreferences().institutionName}</strong><h2>{getTimetablePreferences().pdfTitle}</h2><span>{selectedClass ? label(selectedClass) : ''} - {semesterGroup === 'odd' ? 'Odd' : 'Even'} Semester</span></div>
                <div className="pdf-structure-scroll"><table className="pdf-structure-table class-template-grid"><caption>Weekly timetable</caption><thead><tr><th>DAY / PERIOD</th>{templateColumns.map((column, index) => <th className={column.kind !== 'period' ? 'pdf-break-column' : ''} key={`${column.kind}-${index}`}>{column.label}</th>)}</tr><tr><th>TIME</th>{templateColumns.map((column, index) => { const periodNumber = Number(column.label.match(/\d+/)?.[0]) || templateColumns.filter(item => item.kind === 'period').indexOf(column) + 1; return <th className={column.kind !== 'period' ? 'pdf-break-column' : ''} key={`time-${index}`}>{column.kind === 'period' ? periodTimes.get(periodNumber) || '' : ''}</th>; })}</tr></thead><tbody>{workingDays.map(dayNumber => { const day = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayNumber - 1] || `Day ${dayNumber}`; return <tr key={dayNumber}><th>{day.slice(0, 3).toUpperCase()}</th>{templateColumns.map((column, index) => { if (column.kind !== 'period') return <td className="pdf-break-column" key={`${column.kind}-${index}`}>{column.label}</td>; const periodNumber = Number(column.label.match(/\d+/)?.[0]) || templateColumns.filter(item => item.kind === 'period').indexOf(column) + 1; const entry = entries.find(item => (item.day_of_week ?? item.day + 1) === dayNumber && (item.period_number ?? item.period) === periodNumber); return <td key={`${column.kind}-${index}`}>{entry ? <><strong>{entry.subject_name || 'Subject'}</strong><small>{entry.teacher_name || entry.faculty_name || 'Faculty not assigned'}</small></> : '-'}</td>; })}</tr>; })}</tbody></table></div>
                <div className="pdf-structure-scroll class-template-section-scroll"><table className="pdf-structure-table class-template-subjects"><caption>Subject details</caption><thead><tr>{['S.NO', 'SUB-CODE', 'SUBJECT', 'CREDIT', 'FACULTY NAME', 'DESIGNATION & DEPT.', 'NO. HRS/WEEK'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{(['theory', 'lab'] as const).map(kind => { const subjects = (selectedClass?.subjects || []).filter((subject: any) => (subject.subject_type === 'lab' ? 'lab' : 'theory') === kind); return <Fragment key={kind}><tr className="subject-group-row"><th colSpan={7}>{kind === 'lab' ? 'PRACTICALS' : 'THEORY'}</th></tr>{subjects.map((subject: any, index: number) => <tr key={subject.subject_id}><td>{index + 1}</td><td>{subject.subject_code}</td><td>{subject.subject_name}</td><td>{subject.credits ?? '-'}</td><td>{subject.faculty_name || 'Not assigned'}</td><td>{selectedClass?.department_name || '-'}</td><td>{subject.periods_per_week}</td></tr>)}</Fragment>; })}</tbody></table></div>
                <div className="pdf-structure-scroll class-template-section-scroll"><table className="pdf-structure-table class-template-people"><caption>Class coordination</caption><tbody><tr><th>{templatePreferences.pdfStructure?.coordinatorLabels?.[0] || 'CLASS COORDINATOR'}</th><td>{signatories.classCoordinator || '-'}</td><th>{templatePreferences.pdfStructure?.coordinatorLabels?.[1] || 'FACULTY ADVISOR'}</th><td>{signatories.facultyAdvisor || '-'}</td></tr></tbody></table></div>
                <div className="pdf-structure-scroll class-template-section-scroll"><table className="pdf-structure-table class-template-approvals"><caption>Approval and sign-off</caption><thead><tr>{(['timetableIncharge', 'overallTtCoordinator', 'hod', 'vicePrincipal', 'principal'] as const).map((key, index) => <th key={key}>{templatePreferences.pdfStructure?.approvalLabels?.[index] || ['DEPT. TT COORDINATOR', 'OVERALL TT COORDINATOR', 'HOD', 'VICE-PRINCIPAL', 'PRINCIPAL'][index]}</th>)}</tr></thead><tbody><tr>{(['timetableIncharge', 'overallTtCoordinator', 'hod', 'vicePrincipal', 'principal'] as const).map(key => <td key={key}>{signatories[key] || (key === 'principal' ? getBasicPreferences().principalName : '') || '-'}</td>)}</tr></tbody></table></div>
{editSignatories && <div className="template-signatory-editor"><p>Choose names for the four template tables. Faculty options are filtered to {selectedClass?.department_name || 'the selected department'}.</p>{([{ key: 'classCoordinator', label: 'Class Coordinator' }, { key: 'facultyAdvisor', label: 'Faculty Advisor' }, { key: 'timetableIncharge', label: `Department Timetable Coordinator - ${selectedClass?.department_name || 'Selected department'}` }, { key: 'overallTtCoordinator', label: 'Overall Timetable Coordinator' }, { key: 'hod', label: `HOD - ${selectedClass?.department_name || 'Selected department'}` }, { key: 'vicePrincipal', label: 'Vice Principal' }, { key: 'principal', label: 'Principal' }] as const).map(({ key, label }) => <label key={key}><span>{label}</span><select className="form-input" value={signatories[key] || ''} onChange={event => setSignatories(value => ({ ...value, [key]: event.target.value }))}><option value="">Select a name</option>{key === 'vicePrincipal' && <option value="Dr.P.SUJATHA">Dr.P.SUJATHA</option>}{key === 'principal' && <option value="Dr.M.ARULKUMARAN">Dr.M.ARULKUMARAN</option>}{departmentFaculty.map((member: any) => <option key={member.id} value={member.name}>{member.name}{member.department?.name ? ` · ${member.department.name}` : ''}</option>)}</select></label>)}<button type="button" className="btn btn-primary" onClick={saveSignatories}>Save template details</button></div>}
              </section> : <div style={{ minWidth: 980 }}><TimetableGrid entries={entries} periods={periods} workingDays={workingDays} isEditable={editing && !moving} onEntryMove={moveEntry} onEntryDelete={deleteEntry} onCellSelect={assignSelectedSubject} /></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
