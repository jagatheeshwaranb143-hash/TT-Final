'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { getDefaultSemesterCycle } from '@/lib/preferences';

type SemesterCycle = 'odd' | 'even';
type StageStatus = 'waiting' | 'generating' | 'completed' | 'failed';

const CYCLES: Record<SemesterCycle, number[]> = {
  odd: [1, 3, 5, 7],
  even: [2, 4, 6, 8],
};

const WORKFLOW_OPTIONS: Array<{
  cycle: SemesterCycle;
  label: string;
}> = [
  { cycle: 'odd', label: 'Odd Semester' },
  { cycle: 'even', label: 'Even Semester' },
];

const ordinal = (year: number) => {
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  return '4th Year';
};

export default function GenerateTimetablePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentType, setDepartmentType] = useState<'department' | 'lab' | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [cycle, setCycle] = useState<SemesterCycle>(getDefaultSemesterCycle);
  const [statuses, setStatuses] = useState<Record<number, StageStatus>>({});
  const [results, setResults] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const departmentKey = (value: string = '') => value.toLowerCase().replace(/laboratory|lab/g, '').replace(/[^a-z0-9]/g, '');
  const selectedDepartment = departments.find(item => item.id === departmentId);
  const linkedLiteratureDepartment = departmentType === 'lab' && selectedDepartment
    ? departments.find(item => {
        if ((item.department_type || 'department') !== 'department') return false;
        const labKeys = new Set([departmentKey(selectedDepartment.code), departmentKey(selectedDepartment.name)].filter(Boolean));
        return labKeys.has(departmentKey(item.code)) || labKeys.has(departmentKey(item.name));
      })
    : undefined;
  const activeDepartmentId = linkedLiteratureDepartment?.id || departmentId;

  useEffect(() => {
    Promise.all([api.departments.list(), api.classes.list()])
      .then(([departmentData, classData]: any[]) => {
        const departmentList = Array.isArray(departmentData) ? departmentData : [];
        const classList = Array.isArray(classData) ? classData : [];
        setDepartments(departmentList);
        setClasses(classList);
        const requestedClass = classList.find(item => item.id === searchParams.get('class_id'));
        const requestedDepartmentId = searchParams.get('department_id') || requestedClass?.department_id || '';
        const requestedDepartment = departmentList.find(item => item.id === requestedDepartmentId);
        if (requestedDepartment) {
          setDepartmentType((searchParams.get('department_type') as 'department' | 'lab') || requestedDepartment.department_type || 'department');
          setDepartmentId(requestedDepartmentId);
          const requestedCycle = searchParams.get('cycle');
          setCycle(requestedCycle === 'even' || requestedCycle === 'odd' ? requestedCycle : (requestedClass?.semester % 2 === 0 ? 'even' : 'odd'));
        }
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    setStatuses({});
    setResults({});
    if (!activeDepartmentId || !cycle) return;
    api.timetable.master(activeDepartmentId)
      .then((entries: any) => {
        const classSemester = new Map(
          classes
            .filter(item => item.department_id === activeDepartmentId)
            .map(item => [item.id, item.semester]),
        );
        const counts: Record<number, number> = {};
        for (const entry of Array.isArray(entries) ? entries : []) {
          const semester = classSemester.get(entry.class_id);
          if (typeof semester === 'number' && semester % 2 === (cycle === 'odd' ? 1 : 0) && (departmentType !== 'lab' || entry.subject_type === 'lab')) {
            counts[semester] = (counts[semester] || 0) + 1;
          }
        }
        setResults(counts);
        setStatuses(Object.fromEntries(Object.keys(counts).map(value => [Number(value), 'completed'])));
      })
      .catch((error: Error) => toast.error(error.message));
  }, [activeDepartmentId, cycle, classes, departmentType]);

  const semesters = cycle ? CYCLES[cycle] : [];
  const filteredDepartments = useMemo(
    () => departments.filter(item => (item.department_type || 'department') === departmentType),
    [departments, departmentType],
  );
  const departmentClasses = useMemo(
    () => classes.filter(item => item.department_id === activeDepartmentId),
    [classes, activeDepartmentId],
  );
  const classesForSemester = (semester: number) =>
    departmentClasses.filter(item => item.semester === semester);

  const generateSemester = async (semester: number) => {
    if (!activeDepartmentId || classesForSemester(semester).length === 0) return;
    setStatuses(previous => ({ ...previous, [semester]: 'generating' }));
    try {
      const referenceSemesters = semesters.filter(value => value < semester && statuses[value] === 'completed');
      const result: any = await api.timetable.generate({
        department_id: activeDepartmentId,
        semester,
        reference_semesters: referenceSemesters,
      });
      // Regenerating an earlier stage invalidates every later stage in this
      // cycle. The backend removes those stale schedules, so mirror that state.
      setStatuses(previous => Object.fromEntries(
        Object.entries({ ...previous, [semester]: 'completed' })
          .filter(([value]) => Number(value) <= semester),
      ) as Record<number, StageStatus>);
      const generatedEntries: any[] = departmentType === 'lab'
        ? await api.timetable.master(activeDepartmentId) as any[]
        : [];
      const stageClassIds = new Set(classesForSemester(semester).map(item => item.id));
      const entriesCreated = departmentType === 'lab'
        ? generatedEntries.filter(entry => stageClassIds.has(entry.class_id) && entry.subject_type === 'lab').length
        : result.entries_created || 0;
      setResults(previous => Object.fromEntries(
        Object.entries({ ...previous, [semester]: entriesCreated })
          .filter(([value]) => Number(value) <= semester),
      ) as Record<number, number>);
      toast.success(`Semester ${semester} fixed as the period and faculty reference for the next stage`);
    } catch (error: any) {
      setStatuses(previous => ({ ...previous, [semester]: 'failed' }));
      toast.error(error.message || `Could not generate Semester ${semester}`);
    }
  };

  const generateLabCycle = async () => {
    if (!activeDepartmentId || isGenerating) return;
    const missingSemester = semesters.find(semester => classesForSemester(semester).length === 0);
    if (missingSemester) {
      toast.error(`Add a class for Semester ${missingSemester} before generating the ${cycle} lab timetable.`);
      return;
    }
    try {
      setStatuses(Object.fromEntries(semesters.map(semester => [semester, 'generating'])) as Record<number, StageStatus>);
      for (const semester of semesters) {
        await api.timetable.generate({
          department_id: activeDepartmentId,
          semester,
          reference_semesters: semesters.filter(value => value < semester),
        });
        setStatuses(previous => ({ ...previous, [semester]: 'completed' }));
      }
      const generatedEntries = await api.timetable.master(activeDepartmentId) as any[];
      const classSemester = new Map(departmentClasses.map(item => [item.id, item.semester]));
      const labCounts: Record<number, number> = {};
      generatedEntries.filter(entry => entry.subject_type === 'lab').forEach(entry => {
        const semester = classSemester.get(entry.class_id);
        if (typeof semester === 'number' && semesters.includes(semester)) labCounts[semester] = (labCounts[semester] || 0) + 1;
      });
      setResults(labCounts);
      toast.success(`${cycle === 'odd' ? 'Odd' : 'Even'} semester lab timetable generated`);
    } catch (error: any) {
      setStatuses(previous => Object.fromEntries(Object.entries(previous).map(([semester, status]) => [semester, status === 'generating' ? 'failed' : status])) as Record<number, StageStatus>);
      toast.error(error.message || 'Could not generate the lab timetable');
    }
  };

  // Do not skip a missing default or intermediate stage. The selected cycle
  // must be completed strictly from top to bottom.
  const nextSemester = semesters.find(semester => statuses[semester] !== 'completed');
  const isGenerating = Object.values(statuses).some(status => status === 'generating');
  const labPeriodCount = semesters.reduce((total, semester) => total + (results[semester] || 0), 0);
  const labTimetableReady = labPeriodCount > 0;
  const selectWorkflow = (selectedCycle: SemesterCycle) => {
    if (isGenerating || selectedCycle === cycle) return;
    setStatuses({});
    setResults({});
    setCycle(selectedCycle);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1050, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ color: '#0f766e', fontWeight: 600, fontSize: 13, letterSpacing: '.01em', marginBottom: 6 }}>Class Timetable Workflow</p>
        <h1 style={{ fontSize: 30, color: '#0f172a', letterSpacing: '-.03em' }}>Build timetables semester by semester</h1>
        <p style={{ color: '#64748b', marginTop: 8, maxWidth: 820, lineHeight: 1.6 }}>
          Start with the first-year timetable. Its periods stay fixed, and its faculty allocations are reserved while each later semester in the same odd/even cycle is generated.
        </p>
      </div>

      {loading ? <div className="card">Loading departments and available classes...</div> : !departments.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 42 }}>
          <h2 style={{ marginBottom: 8 }}>Create a department first</h2>
          <p style={{ color: '#64748b', marginBottom: 18 }}>This workflow needs a department before classes can be configured.</p>
          <button className="btn btn-primary" onClick={() => router.push('/departments')}>Go to Departments</button>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 20, alignItems: 'end' }}>
              <div>
                <label className="form-label" htmlFor="department-type-selector">Department type</label>
                <select id="department-type-selector" className="form-input" value={departmentType} onChange={event => { setDepartmentType(event.target.value as 'department' | 'lab' | ''); setDepartmentId(''); setCycle(getDefaultSemesterCycle()); }} disabled={isGenerating} style={{ marginTop: 7, padding: 12 }}>
                  <option value="" disabled hidden>Choose department type</option>
                  <option value="department">Literature Department</option>
                  <option value="lab">Lab Department</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="department-selector">Department</label>
                <select id="department-selector" className="form-input" value={departmentId} onChange={event => { setDepartmentId(event.target.value); setCycle(getDefaultSemesterCycle()); }} disabled={!departmentType || isGenerating} style={{ marginTop: 7, padding: 12 }}>
                  <option value="" disabled hidden>{departmentType ? 'Choose a department' : 'Choose department type first'}</option>
                  {filteredDepartments.map((item: any) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="semester-type-selector">Choose semester type</label>
                <select
                  id="semester-type-selector"
                  className="form-input"
                  value={cycle}
                  onChange={event => selectWorkflow(event.target.value as SemesterCycle)}
                  disabled={isGenerating || !departmentId}
                  style={{ marginTop: 7, padding: 12 }}
                >
                  {WORKFLOW_OPTIONS.map(option => (
                    <option key={option.cycle} value={option.cycle}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!departmentId ? (
            <div className="card" style={{ padding: 42, textAlign: 'center' }}>
              <h2 style={{ color: '#0f172a', fontSize: 20 }}>Choose a department</h2>
              <p style={{ color: '#64748b', marginTop: 8 }}>Select Literature or Lab Department, then choose a department to build its timetables.</p>
            </div>
          ) : departmentType === 'lab' ? (
            <div className="card" style={{ padding: 26, border: labTimetableReady ? '1px solid #c4b5fd' : '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ color: '#7c3aed', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>Lab timetable</p>
                  <h2 style={{ color: '#0f172a', fontSize: 21 }}>{cycle === 'odd' ? 'Odd' : 'Even'} Semester Lab Timetable</h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginTop: 7 }}>{selectedDepartment?.name || 'Selected lab'} · {labTimetableReady ? `${labPeriodCount} lab periods generated` : 'Generate all lab periods in one timetable'}</p>
                  {linkedLiteratureDepartment && <p style={{ color: '#7c3aed', fontSize: 12, marginTop: 5 }}>Uses classes and lab subjects from {linkedLiteratureDepartment.name} ({linkedLiteratureDepartment.code})</p>}
                  {!linkedLiteratureDepartment && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 5 }}>No matching Literature department found for this lab.</p>}
                </div>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                  {labTimetableReady && <button type="button" className="btn btn-secondary" onClick={() => router.push(`/timetable/lab?department_id=${encodeURIComponent(activeDepartmentId)}&lab_name=${encodeURIComponent(selectedDepartment?.name || 'Lab')}&cycle=${cycle}`)}>View</button>}
                  <button type="button" className="btn btn-primary" onClick={generateLabCycle} disabled={isGenerating || !linkedLiteratureDepartment}>
                    {isGenerating ? 'Generating...' : labTimetableReady ? 'Regenerate Lab Timetable' : 'Generate Lab Timetable'}
                  </button>
                </div>
              </div>
            </div>
          ) : <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ color: '#0f172a', fontSize: 20 }}>{cycle === 'odd' ? 'Odd' : 'Even'} semester timetable stages</h2>
              <span style={{ color: '#64748b', fontSize: 13 }}>{semesters.map(value => `Semester ${value}`).join(' → ')}</span>
            </div>
            {semesters.map((semester, index) => {
              const stageClasses = classesForSemester(semester);
              const status = statuses[semester] || 'waiting';
              const isNext = semester === nextSemester;
              const completed = status === 'completed';
              const unavailable = stageClasses.length === 0;
              return (
                <div key={semester} className="card" style={{ padding: 22, border: completed ? '1px solid #86efac' : isNext ? '1px solid #5eead4' : '1px solid #e2e8f0', opacity: unavailable ? .72 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, color: completed ? '#166534' : isNext ? '#115e59' : '#64748b', background: completed ? '#dcfce7' : isNext ? '#ccfbf1' : '#f1f5f9' }}>
                        {completed ? '✓' : index + 1}
                      </div>
                      <div>
                        <h2 style={{ fontSize: 18, color: '#0f172a', marginBottom: 4 }}>{ordinal(index + 1)} · Semester {semester}</h2>
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                          {unavailable ? 'No class configured — add this semester before continuing' : `${stageClasses.length} class${stageClasses.length === 1 ? '' : 'es'} · ${stageClasses.reduce((total, item) => total + (item.subjects?.length || 0), 0)} subject allocations`}
                        </p>
                        {completed && <p style={{ color: '#15803d', fontSize: 13, marginTop: 5 }}>{results[semester]} fixed periods; faculty allocations reserved for later stages</p>}
                        {isNext && index > 0 && <p style={{ color: '#0f766e', fontSize: 13, marginTop: 5 }}>Uses: {semesters.filter(value => value < semester && statuses[value] === 'completed').map(value => `Semester ${value}`).join(', ')} as fixed reference</p>}
                        {status === 'failed' && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 5 }}>Generation failed. Correct the data and retry this stage.</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 9 }}>
                      {completed && stageClasses[0] && <button type="button" className="btn btn-secondary" onClick={() => router.push(`/timetable?class_id=${stageClasses[0].id}`)}>View</button>}
                      <button type="button" className="btn btn-primary" onClick={() => generateSemester(semester)} disabled={unavailable || isGenerating || (!isNext && !completed)} title={!isNext && !completed ? 'Complete the earlier configured semester first' : undefined}>
                        {status === 'generating' ? 'Generating...' : completed ? 'Regenerate stage' : isNext ? 'Generate & reserve' : 'Waiting for earlier stage'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>}
        </>
      )}
    </div>
  );
}
