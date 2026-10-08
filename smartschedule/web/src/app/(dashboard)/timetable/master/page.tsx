'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileDown, Table2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getDefaultSemesterCycle, getTimetablePreferences } from '@/lib/preferences';
import { exportMasterAllDaysPdf, exportMasterDayPdf } from '@/lib/timetable-pdf';

const weekdays = [
  { apiDay: 0, label: 'Monday', short: 'Mon' },
  { apiDay: 1, label: 'Tuesday', short: 'Tue' },
  { apiDay: 2, label: 'Wednesday', short: 'Wed' },
  { apiDay: 3, label: 'Thursday', short: 'Thu' },
  { apiDay: 4, label: 'Friday', short: 'Fri' },
];

function buildPeriods() {
  const preferences = getTimetablePreferences();
  const [hour, minute] = preferences.dayStart.split(':').map(Number);
  let cursor = hour * 60 + minute;
  const format = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return Array.from({ length: preferences.periodsPerDay }, (_, index) => {
    const from = cursor;
    const to = from + preferences.periodMinutes;
    cursor = to;
    const periodNumber = index + 1;
    if (periodNumber === preferences.intervalAfterPeriod && preferences.intervalMinutes > 0) cursor += preferences.intervalMinutes;
    if (periodNumber === preferences.lunchAfterPeriod && preferences.lunchMinutes > 0) cursor += preferences.lunchMinutes;
    if (periodNumber === 6 && preferences.intervalAfterPeriod !== 6 && preferences.lunchAfterPeriod !== 6) cursor += preferences.intervalMinutes;
    return { number: index + 1, label: `P${index + 1}`, time: `${format(from)}–${format(from + preferences.periodMinutes)}` };
  });
}

export default function MasterTimetablePage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [departmentType, setDepartmentType] = useState<'department' | 'lab' | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [semesterType, setSemesterType] = useState<'odd' | 'even'>(getDefaultSemesterCycle);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [includeBreaks, setIncludeBreaks] = useState(false);
  const [periods] = useState(() => buildPeriods());
  const departmentKey = (value: string = '') => value.toLowerCase().replace(/laboratory|lab/g, '').replace(/[^a-z0-9]/g, '');
  const selectedDepartment = departments.find(item => item.id === departmentId);
  const linkedLiteratureDepartment = departmentType === 'lab' && selectedDepartment
    ? departments.find(item => {
        if ((item.department_type || 'department') !== 'department') return false;
        const keys = new Set([departmentKey(selectedDepartment.code), departmentKey(selectedDepartment.name)].filter(Boolean));
        return keys.has(departmentKey(item.code)) || keys.has(departmentKey(item.name));
      })
    : undefined;
  const activeDepartmentId = linkedLiteratureDepartment?.id || departmentId;

  useEffect(() => {
    Promise.all([api.departments.list(), api.classes.list()])
      .then(([departmentData, classData]: any[]) => {
        setDepartments(Array.isArray(departmentData) ? departmentData : []);
        setClasses(Array.isArray(classData) ? classData : []);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeDepartmentId) {
      setEntries([]);
      return;
    }
    setEntriesLoading(true);
    api.timetable.master(activeDepartmentId)
      .then((data: any) => setEntries(Array.isArray(data) ? data : []))
      .catch((error: Error) => {
        setEntries([]);
        toast.error(error.message);
      })
      .finally(() => setEntriesLoading(false));
  }, [activeDepartmentId]);

  const availableDepartments = useMemo(() => departments
    .filter(item => (item.department_type || 'department') === departmentType)
    .sort((left, right) => String(left.name).localeCompare(String(right.name))), [departments, departmentType]);

  const visibleClasses = useMemo(() => classes
    .filter(item => item.department_id === activeDepartmentId && (semesterType === 'odd' ? item.semester % 2 === 1 : item.semester % 2 === 0))
    .sort((left, right) => left.year - right.year || left.semester - right.semester || String(left.section).localeCompare(String(right.section))),
  [classes, activeDepartmentId, semesterType]);
  const visibleClassIds = useMemo(() => new Set(visibleClasses.map(item => item.id)), [visibleClasses]);
  const allVisibleEntries = useMemo(() => entries.filter(item => visibleClassIds.has(item.class_id) && (departmentType !== 'lab' || item.subject_type === 'lab')), [entries, visibleClassIds, departmentType]);
  const visibleEntries = useMemo(() => entries.filter(item => visibleClassIds.has(item.class_id) && item.day === selectedDay && (departmentType !== 'lab' || item.subject_type === 'lab')), [entries, visibleClassIds, selectedDay, departmentType]);

  const entryAt = (classId: string, period: number) => visibleEntries.filter(item => item.class_id === classId && item.period === period);
  const preferences = getTimetablePreferences();
  const breakAfter: Record<number, string> = {};
  if (preferences.intervalAfterPeriod > 0) breakAfter[preferences.intervalAfterPeriod] = 'Interval';
  if (preferences.lunchAfterPeriod > 0) breakAfter[preferences.lunchAfterPeriod] = 'Lunch';
  if (periods.length >= 7 && !breakAfter[6]) breakAfter[6] = 'Break';
  const classLabel = (item: any) => `Year ${item.year} · Semester ${item.semester}${item.section && item.section !== 'A' ? ` · ${item.section}` : ''}`;

  const exportSelectedDay = () => {
    try {
      exportMasterDayPdf({
        title: `${selectedDepartment?.name || 'Department'} Master Timetable`,
        subtitle: `${semesterType === 'odd' ? 'Odd' : 'Even'} semesters`,
        dayName: weekdays[selectedDay].label,
        classes: visibleClasses.map(item => ({ id: item.id, label: classLabel(item) })),
        entries: visibleEntries,
        periods,
        includeBreaks,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export timetable');
    }
  };
  const exportAllDays = () => {
    try {
      exportMasterAllDaysPdf({
        title: `${selectedDepartment?.name || 'Department'} Master Timetable`,
        subtitle: `${semesterType === 'odd' ? 'Odd' : 'Even'} semesters`,
        days: weekdays,
        classes: visibleClasses.map(item => ({ id: item.id, label: classLabel(item) })),
        entries: allVisibleEntries,
        periods,
        includeBreaks,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export all timetables');
    }
  };

  return (
    <div className="master-page">
      <header className="master-heading">
        <div className="master-title-icon"><Table2 size={24} /></div>
        <div>
          <h1>Master timetable</h1>
          <p>View every class period for one department and weekday.</p>
        </div>
      </header>

      <section className="card master-filters" aria-label="Master timetable filters">
        <div>
          <label className="form-label" htmlFor="master-department-type">Department Type</label>
          <select id="master-department-type" className="form-input" value={departmentType} onChange={event => { setDepartmentType(event.target.value as 'department' | 'lab' | ''); setDepartmentId(''); }}>
            <option value="" disabled hidden>Choose department type</option>
            <option value="department">Literature Department</option>
            <option value="lab">Lab Department</option>
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="master-department">Department</label>
          <select id="master-department" className="form-input" value={departmentId} disabled={!departmentType} onChange={event => setDepartmentId(event.target.value)}>
            <option value="" disabled hidden>{departmentType ? 'Choose department' : 'Choose department type first'}</option>
            {availableDepartments.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="master-semester-type">Semester Type</label>
          <select id="master-semester-type" className="form-input" value={semesterType} disabled={!departmentId} onChange={event => setSemesterType(event.target.value as 'odd' | 'even')}>
            <option value="odd">Odd Semester</option>
            <option value="even">Even Semester</option>
          </select>
        </div>
      </section>

      <section className="master-day-section" aria-labelledby="master-day-heading">
        <div className="master-day-heading">
          <div><span><CalendarDays size={17} /></span><div><strong id="master-day-heading">Choose weekday</strong><small>Show one day across every class</small></div></div>
          {departmentId && <span>{visibleEntries.length} scheduled period{visibleEntries.length === 1 ? '' : 's'}</span>}
        </div>
        <div className="master-day-slider" role="tablist" aria-label="Weekday">
          {weekdays.map(day => <button key={day.apiDay} type="button" role="tab" aria-selected={selectedDay === day.apiDay} className={selectedDay === day.apiDay ? 'active' : ''} onClick={() => setSelectedDay(day.apiDay)}>
            <span>{day.short}</span>{day.label}
          </button>)}
        </div>
      </section>

      {loading ? <div className="card master-empty">Loading departments and classes…</div> : !departmentId ? (
        <div className="card master-empty"><Table2 size={32} /><h2>Choose a department</h2><p>Select department type, department, and semester type to view its master timetable.</p></div>
      ) : entriesLoading ? <div className="card master-empty">Loading master timetable…</div> : visibleClasses.length === 0 ? (
        <div className="card master-empty"><h2>No matching classes</h2><p>No {semesterType} semester classes are configured for {selectedDepartment?.name}.</p></div>
      ) : (
        <section className="card master-table-card" aria-label={`${selectedDepartment?.name || 'Department'} ${weekdays[selectedDay].label} master timetable`}>
          <div className="master-table-caption"><div><strong>{selectedDepartment?.name}</strong><span>{semesterType === 'odd' ? 'Odd' : 'Even'} semesters · {weekdays[selectedDay].label}</span></div><span>{visibleClasses.length} classes</span></div>
        <div className="master-export-row"><label className="master-break-option"><span>Timetable breaks</span><select className="form-input" value={includeBreaks ? 'with-breaks' : 'periods-only'} onChange={event => setIncludeBreaks(event.target.value === 'with-breaks')}><option value="periods-only">Periods only</option><option value="with-breaks">Show configured breaks (incl. after Period 6)</option></select></label><div><button type="button" className="btn btn-secondary master-export" onClick={exportSelectedDay}><FileDown size={16} />Export master timetable: {weekdays[selectedDay].label}</button><button type="button" className="btn btn-primary master-export" onClick={exportAllDays}><FileDown size={16} />Export master timetable: all days</button></div></div>
          <div className="master-table-scroll">
            <table className="master-table">
              <thead><tr><th>Class</th>{periods.map(period => <Fragment key={period.number}><th><strong>{period.label}</strong><span>{period.time}</span></th>{includeBreaks && breakAfter[period.number] && period.number < periods.length && <th className="master-break-column">{breakAfter[period.number]}</th>}</Fragment>)}</tr></thead>
              <tbody>{visibleClasses.map(classItem => <tr key={classItem.id}>
                <th scope="row"><strong>{classLabel(classItem)}</strong><span>{selectedDepartment?.code}</span></th>
                {periods.map(period => {
                  const periodEntries = entryAt(classItem.id, period.number);
                  return <Fragment key={period.number}><td>{periodEntries.length ? periodEntries.map((entry, index) => <div className={`master-period ${entry.subject_type === 'lab' ? 'lab' : ''}`} key={entry.id || index}>
                    <strong>{entry.subject_code || entry.subject_name}</strong>
                    <span>{entry.subject_name}</span>
                    <small>{entry.faculty_name || 'Faculty not assigned'}</small>
                  </div>) : <span className="master-free">Free</span>}</td>{includeBreaks && breakAfter[period.number] && period.number < periods.length && <td className="master-break-column"><span>{breakAfter[period.number]}</span></td>}</Fragment>;
                })}
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
